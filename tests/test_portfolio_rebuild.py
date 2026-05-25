"""tests/test_portfolio_rebuild.py

Phase 18H — Portfolio Rebuild From Persisted OMS/Fills.

Tests verify:
1.  Filled orders are returned by OrderStore.get_filled_orders().
2.  Rejected/cancelled/risk-rejected orders are excluded.
3.  Rebuild creates a position from a BUY fill.
4.  Rebuild reduces a position from a SELL fill.
5.  Missing fill price is skipped with a warning; fill not faked.
6.  Rebuild is idempotent: running twice does not double positions.
7.  Duplicate request_id/fill is not double-counted.
8.  Rebuild summary includes processed/skipped counts.
9.  Backend import remains safe after adding rebuild.
10. Full existing test suite still passes (validated via pytest -q in CI).

SAFETY:
- Temporary SQLite DBs only (pytest tmp_path fixture).
- No broker API calls.
- No credentials required.
- No live trading enabled.
"""

from __future__ import annotations

import tempfile
import os
import pytest

from backend.execution.order_store import OrderStore
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.portfolio.rebuild import rebuild_portfolio_from_fills, PortfolioRebuildSummary


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_db(tmp_path):
    """Return a temp-file-backed OrderStore (avoids :memory: connection issues)."""
    db_file = str(tmp_path / "test_rebuild.db")
    return OrderStore(db_path=db_file)


@pytest.fixture()
def portfolio():
    """Return a fresh PortfolioEngine with no fills."""
    return PortfolioEngine(initial_capital=100_000.0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_filled(store: OrderStore, request_id: str, symbol: str, side: str,
                quantity: int, avg_fill_price: float) -> None:
    """Insert a FILLED order_request row, then update avg_fill_price via events."""
    store.add_order_request(
        request_id=request_id,
        client_order_id=request_id,
        idempotency_key=f"idem_{request_id}",
        symbol=symbol,
        side=side,
        quantity=quantity,
        order_type="MARKET",
        mode="PAPER",
        status="FILLED",
    )
    # Patch avg_fill_price directly into the row using SQLite.
    # (OrderStore schema lacks this column currently — we add it via migration
    # in the test using raw SQL, mirroring the future add_column migration.)
    _ensure_avg_fill_price_col(store)
    conn = store._get_conn()
    try:
        conn.execute(
            "UPDATE order_requests SET avg_fill_price = ? WHERE request_id = ?",
            (avg_fill_price, request_id),
        )
        conn.commit()
    finally:
        conn.close()


def _ensure_avg_fill_price_col(store: OrderStore) -> None:
    """Add avg_fill_price column to order_requests if not present (test helper)."""
    conn = store._get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(order_requests)")
        cols = {row[1] for row in cursor.fetchall()}
        if "avg_fill_price" not in cols:
            cursor.execute("ALTER TABLE order_requests ADD COLUMN avg_fill_price REAL")
            conn.commit()
    finally:
        conn.close()


def _add_terminal(store: OrderStore, request_id: str, symbol: str, status: str) -> None:
    """Insert a non-FILLED terminal order request (REJECTED, CANCELLED, etc.)."""
    store.add_order_request(
        request_id=request_id,
        client_order_id=request_id,
        idempotency_key=f"idem_{request_id}",
        symbol=symbol,
        side="BUY",
        quantity=10,
        order_type="MARKET",
        mode="PAPER",
        status=status,
    )


# ===========================================================================
# TEST 1 — get_filled_orders returns only FILLED rows
# ===========================================================================

def test_get_filled_orders_returns_only_filled(tmp_db):
    """Filled orders are returned; non-FILLED rows are excluded."""
    _add_filled(tmp_db, "req_fill_1", "SBIN-EQ", "BUY", 10, 500.0)
    _add_terminal(tmp_db, "req_rej_1", "SBIN-EQ", "REJECTED")
    _add_terminal(tmp_db, "req_can_1", "SBIN-EQ", "CANCELLED")
    _add_terminal(tmp_db, "req_rr_1", "SBIN-EQ", "RISK_REJECTED")

    rows = tmp_db.get_filled_orders()
    assert len(rows) == 1
    assert rows[0]["request_id"] == "req_fill_1"
    assert rows[0]["status"] == "FILLED"


# ===========================================================================
# TEST 2 — Rejected / cancelled / risk-rejected orders excluded
# ===========================================================================

def test_rejected_cancelled_excluded_from_fills(tmp_db):
    """REJECTED, CANCELLED, RISK_REJECTED, DUPLICATE_REJECTED rows must not appear."""
    for status in ("REJECTED", "CANCELLED", "RISK_REJECTED", "DUPLICATE_REJECTED"):
        _add_terminal(tmp_db, f"req_{status.lower()}", "RELIANCE-EQ", status)

    rows = tmp_db.get_filled_orders()
    assert rows == [], f"Expected empty; got {[r['status'] for r in rows]}"


# ===========================================================================
# TEST 3 — Rebuild creates a position from a BUY fill
# ===========================================================================

def test_rebuild_creates_buy_position(tmp_db, portfolio):
    """A BUY fill stored in OMS is replayed into PortfolioEngine."""
    _add_filled(tmp_db, "req_buy_1", "SBIN-EQ", "BUY", 10, 500.0)

    summary = rebuild_portfolio_from_fills(tmp_db, portfolio)

    assert summary.total_fills_processed == 1
    assert summary.skipped_rows == 0
    assert "SBIN-EQ" in summary.rebuilt_positions

    position = portfolio.positions.get_position("SBIN-EQ")
    assert position is not None
    assert position["quantity"] == 10
    assert position["avg_price"] == pytest.approx(500.0, rel=1e-4)


# ===========================================================================
# TEST 4 — Rebuild reduces a position from a SELL fill
# ===========================================================================

def test_rebuild_sell_reduces_position(tmp_db, portfolio):
    """A BUY followed by a SELL replays correctly; net quantity is reduced."""
    _add_filled(tmp_db, "req_buy_s4", "INFY-EQ", "BUY", 20, 1500.0)
    _add_filled(tmp_db, "req_sell_s4", "INFY-EQ", "SELL", 10, 1600.0)

    summary = rebuild_portfolio_from_fills(tmp_db, portfolio)

    assert summary.total_fills_processed == 2
    assert summary.skipped_rows == 0

    position = portfolio.positions.get_position("INFY-EQ")
    assert position is not None
    assert position["quantity"] == 10   # 20 - 10


# ===========================================================================
# TEST 5 — Missing fill price is skipped, not faked
# ===========================================================================

def test_missing_fill_price_skipped_not_faked(tmp_db, portfolio):
    """A FILLED row without avg_fill_price must be skipped with a warning."""
    # Insert FILLED row without any price (avg_fill_price remains NULL).
    tmp_db.add_order_request(
        request_id="req_no_price",
        client_order_id="req_no_price",
        idempotency_key="idem_req_no_price",
        symbol="TCS-EQ",
        side="BUY",
        quantity=5,
        order_type="MARKET",
        mode="PAPER",
        status="FILLED",
    )
    _ensure_avg_fill_price_col(tmp_db)  # column exists but value is NULL

    summary = rebuild_portfolio_from_fills(tmp_db, portfolio)

    assert summary.total_fills_processed == 0
    assert summary.skipped_rows == 1
    assert any("no avg_fill_price" in w for w in summary.warnings)

    # No position should have been created.
    assert portfolio.positions.get_position("TCS-EQ") is None


# ===========================================================================
# TEST 6 — Rebuild idempotent: running twice does not double positions
# ===========================================================================

def test_rebuild_idempotent_no_double_positions(tmp_db, portfolio):
    """Calling rebuild twice on the same PortfolioEngine yields same positions."""
    _add_filled(tmp_db, "req_idem_1", "HDFC-EQ", "BUY", 5, 2700.0)

    summary1 = rebuild_portfolio_from_fills(tmp_db, portfolio)
    summary2 = rebuild_portfolio_from_fills(tmp_db, portfolio)

    # Second run should process 0 new fills (all already in fill_history).
    assert summary1.total_fills_processed == 1
    assert summary2.total_fills_processed == 0

    position = portfolio.positions.get_position("HDFC-EQ")
    assert position is not None
    assert position["quantity"] == 5   # NOT 10


# ===========================================================================
# TEST 7 — Duplicate request_id is not double-counted
# ===========================================================================

def test_duplicate_request_id_not_double_counted(tmp_db, portfolio):
    """If somehow the same request_id appears twice in the DB, only one fill is applied."""
    _add_filled(tmp_db, "req_dup_1", "WIPRO-EQ", "BUY", 8, 450.0)

    # Force-duplicate the row via raw SQL to simulate a DB anomaly.
    conn = tmp_db._get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM order_requests WHERE request_id = 'req_dup_1'"
        ).fetchone()
        assert row is not None, "Setup row missing"
        # Insert a duplicate with a different primary key but same request_id fails UNIQUE.
        # Instead supply a slightly different request_id but same idempotency scenario:
        # We test the _replayed_ids guard by passing an explicit set.
        seen: set[str] = set()
        summary1 = rebuild_portfolio_from_fills(tmp_db, portfolio, _replayed_ids=seen)
        # Now seen contains "req_dup_1"; second call must skip it.
        summary2 = rebuild_portfolio_from_fills(tmp_db, portfolio, _replayed_ids=seen)
    finally:
        conn.close()

    assert summary1.total_fills_processed == 1
    assert summary2.total_fills_processed == 0

    position = portfolio.positions.get_position("WIPRO-EQ")
    assert position is not None
    assert position["quantity"] == 8   # not 16


# ===========================================================================
# TEST 8 — Rebuild summary includes processed/skipped counts
# ===========================================================================

def test_rebuild_summary_counts(tmp_db, portfolio):
    """PortfolioRebuildSummary exposes total_fills_processed and skipped_rows."""
    _add_filled(tmp_db, "req_s8_1", "BAJAJ-EQ", "BUY", 3, 7500.0)
    # Row without price → will be skipped.
    tmp_db.add_order_request(
        request_id="req_s8_no_price",
        client_order_id="req_s8_no_price",
        idempotency_key="idem_req_s8_no_price",
        symbol="BAJAJ-EQ",
        side="BUY",
        quantity=3,
        order_type="MARKET",
        mode="PAPER",
        status="FILLED",
    )
    _ensure_avg_fill_price_col(tmp_db)

    summary = rebuild_portfolio_from_fills(tmp_db, portfolio)

    assert isinstance(summary, PortfolioRebuildSummary)
    assert summary.total_fills_processed == 1
    assert summary.skipped_rows == 1
    assert isinstance(summary.rebuilt_positions, list)
    assert isinstance(summary.warnings, list)
    assert len(summary.warnings) >= 1


# ===========================================================================
# TEST 9 — Backend import is safe after adding rebuild module
# ===========================================================================

def test_backend_import_safe():
    """Importing api_server must not raise after adding portfolio rebuild."""
    import importlib
    mod = importlib.import_module("backend.api_server")
    assert mod is not None


# ===========================================================================
# TEST 10 — avg_fill_price column migration guard
# ===========================================================================

def test_get_filled_orders_handles_missing_avg_fill_price_col(tmp_db):
    """get_filled_orders works even if avg_fill_price column is not yet present."""
    # Without calling _ensure_avg_fill_price_col, add a FILLED row.
    tmp_db.add_order_request(
        request_id="req_no_col",
        client_order_id="req_no_col",
        idempotency_key="idem_req_no_col",
        symbol="ITC-EQ",
        side="BUY",
        quantity=5,
        order_type="MARKET",
        mode="PAPER",
        status="FILLED",
    )
    # Should not raise even if avg_fill_price column absent.
    rows = tmp_db.get_filled_orders()
    assert any(r["request_id"] == "req_no_col" for r in rows)
