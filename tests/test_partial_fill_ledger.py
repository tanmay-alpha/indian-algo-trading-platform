"""tests/test_partial_fill_ledger.py

Phase 18I tests: order_fills ledger (OrderStore) and fill-aware portfolio rebuild.

Coverage:
  1. Smoke — OrderStore initialises with order_fills table (fresh and legacy DB)
  2. record_fill — successful insert returns True
  3. record_fill — duplicate fill_id returns False (idempotent)
  4. record_fill — validation rejects bad fill_id, qty<=0, price<=0
  5. fill_exists — correct True/False
  6. get_fills_for_request — returns rows for matching request_id only
  7. get_all_fills_chronological — returns all rows in insertion order
  8. get_cumulative_filled_quantity — sums qty across multiple fills
  9. Portfolio rebuild — fill ledger path (Phase 18I)
 10. Portfolio rebuild — partial fills accumulate position correctly
 11. Portfolio rebuild — idempotency: second call does not double-count
 12. Portfolio rebuild — fallback to order_requests when fill ledger empty
 13. Portfolio rebuild — mixed BUY then SELL via fill ledger
 14. Portfolio rebuild — skips rows with missing fill_price (warns, no crash)
 15. Portfolio rebuild — legacy DB without order_fills uses fallback gracefully
 16. get_cumulative_filled_quantity — returns 0 for unknown request_id
 17. record_fill — symbols/sides stored uppercase
 18. PaperOrderManager — records fill to ledger on successful paper execution
"""

import asyncio
import os
import tempfile
import uuid

import pytest

from backend.execution.order_store import OrderStore
from backend.execution.fee_model import NSEFeeModel
from backend.execution.paper_execution_config import PaperExecutionConfig
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.portfolio.rebuild import (
    PortfolioRebuildSummary,
    rebuild_portfolio_from_fills,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_store() -> tuple[OrderStore, str]:
    """Create a temp-file-backed OrderStore; return (store, path)."""
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    return OrderStore(f.name), f.name


def cleanup(path: str) -> None:
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass


def _add_filled_order(
    store: OrderStore,
    request_id: str,
    symbol: str,
    side: str,
    quantity: int,
    avg_fill_price: float,
) -> None:
    """Helper: insert a FILLED order_request row (for fallback tests)."""
    store.add_order_request(
        request_id=request_id,
        client_order_id=request_id,
        idempotency_key=request_id,
        symbol=symbol,
        side=side,
        quantity=quantity,
        order_type="MARKET",
        mode="PAPER",
        status="FILLED",
    )
    store.update_order_status(request_id, "FILLED", avg_fill_price=avg_fill_price)


# ---------------------------------------------------------------------------
# 1. Smoke — OrderStore init creates order_fills table
# ---------------------------------------------------------------------------

def test_order_store_creates_fills_table():
    store, path = make_store()
    try:
        import sqlite3
        conn = sqlite3.connect(path)
        cursor = conn.execute("PRAGMA table_info(order_fills)")
        cols = [row[1] for row in cursor.fetchall()]
        conn.close()
        assert "fill_id" in cols
        assert "request_id" in cols
        assert "filled_quantity" in cols
        assert "fill_price" in cols
        assert "fees" in cols
        assert "source" in cols
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 2. record_fill — successful insert
# ---------------------------------------------------------------------------

def test_record_fill_success():
    store, path = make_store()
    try:
        ok = store.record_fill(
            fill_id="fill-001",
            request_id="req-001",
            symbol="RELIANCE",
            side="BUY",
            filled_quantity=10,
            fill_price=2500.0,
            source="paper",
        )
        assert ok is True
        fills = store.get_fills_for_request("req-001")
        assert len(fills) == 1
        assert fills[0]["fill_price"] == 2500.0
        assert fills[0]["symbol"] == "RELIANCE"
        assert fills[0]["side"] == "BUY"
        assert fills[0]["source"] == "paper"
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 3. record_fill — duplicate fill_id returns False
# ---------------------------------------------------------------------------

def test_record_fill_idempotent():
    store, path = make_store()
    try:
        store.record_fill("fill-dup", "req-dup", "INFY", "SELL", 5, 1500.0)
        result = store.record_fill("fill-dup", "req-dup", "INFY", "SELL", 5, 1500.0)
        assert result is False
        # Only one row in DB
        assert len(store.get_fills_for_request("req-dup")) == 1
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 4. record_fill — validation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("kwargs,reason", [
    ({"fill_id": "", "request_id": "r", "symbol": "X", "side": "BUY", "filled_quantity": 1, "fill_price": 100.0}, "empty fill_id"),
    ({"fill_id": "f", "request_id": "", "symbol": "X", "side": "BUY", "filled_quantity": 1, "fill_price": 100.0}, "empty request_id"),
    ({"fill_id": "f", "request_id": "r", "symbol": "X", "side": "BUY", "filled_quantity": 0, "fill_price": 100.0}, "qty=0"),
    ({"fill_id": "f2", "request_id": "r", "symbol": "X", "side": "BUY", "filled_quantity": -1, "fill_price": 100.0}, "qty<0"),
    ({"fill_id": "f3", "request_id": "r", "symbol": "X", "side": "BUY", "filled_quantity": 1, "fill_price": 0.0}, "price=0"),
    ({"fill_id": "f4", "request_id": "r", "symbol": "X", "side": "BUY", "filled_quantity": 1, "fill_price": -5.0}, "price<0"),
])
def test_record_fill_validation(kwargs, reason):
    store, path = make_store()
    try:
        result = store.record_fill(**kwargs)
        assert result is False, f"Expected False for {reason}"
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 5. fill_exists
# ---------------------------------------------------------------------------

def test_fill_exists():
    store, path = make_store()
    try:
        assert store.fill_exists("nonexistent") is False
        store.record_fill("fill-e1", "req-e1", "TCS", "BUY", 5, 3200.0)
        assert store.fill_exists("fill-e1") is True
        assert store.fill_exists("nonexistent") is False
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 6. get_fills_for_request — only matching rows
# ---------------------------------------------------------------------------

def test_get_fills_for_request_isolated():
    store, path = make_store()
    try:
        store.record_fill("f1", "req-A", "HDFCBANK", "BUY", 10, 1600.0)
        store.record_fill("f2", "req-A", "HDFCBANK", "BUY", 5, 1605.0)
        store.record_fill("f3", "req-B", "ICICIBANK", "SELL", 3, 900.0)
        fills_a = store.get_fills_for_request("req-A")
        fills_b = store.get_fills_for_request("req-B")
        assert len(fills_a) == 2
        assert len(fills_b) == 1
        assert fills_b[0]["symbol"] == "ICICIBANK"
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 7. get_all_fills_chronological
# ---------------------------------------------------------------------------

def test_get_all_fills_chronological():
    store, path = make_store()
    try:
        store.record_fill("g1", "req-X", "A", "BUY", 1, 100.0)
        store.record_fill("g2", "req-X", "A", "BUY", 2, 101.0)
        store.record_fill("g3", "req-Y", "B", "SELL", 3, 50.0)
        rows = store.get_all_fills_chronological()
        assert len(rows) == 3
        assert rows[0]["fill_id"] == "g1"
        assert rows[2]["fill_id"] == "g3"
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 8. get_cumulative_filled_quantity
# ---------------------------------------------------------------------------

def test_get_cumulative_filled_quantity():
    store, path = make_store()
    try:
        assert store.get_cumulative_filled_quantity("req-c") == 0
        store.record_fill("c1", "req-c", "Z", "BUY", 7, 200.0)
        assert store.get_cumulative_filled_quantity("req-c") == 7
        store.record_fill("c2", "req-c", "Z", "BUY", 3, 201.0)
        assert store.get_cumulative_filled_quantity("req-c") == 10
        # Different request_id must not affect result
        store.record_fill("c3", "req-other", "Z", "BUY", 100, 200.0)
        assert store.get_cumulative_filled_quantity("req-c") == 10
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 9. Portfolio rebuild — fill ledger path
# ---------------------------------------------------------------------------

def test_rebuild_from_fill_ledger():
    store, path = make_store()
    try:
        store.record_fill("p1", "req-p1", "RELIANCE", "BUY", 10, 2500.0, fees=25.0, source="paper")
        engine = PortfolioEngine(initial_capital=100_000.0)
        summary = rebuild_portfolio_from_fills(store, engine)
        assert summary.total_fills_processed == 1
        assert summary.skipped_rows == 0
        assert "RELIANCE" in summary.rebuilt_positions
        assert summary.source == "fill_ledger"
        pos = engine.positions.get_position("RELIANCE")
        assert pos is not None
        assert pos["quantity"] == 10
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 10. Portfolio rebuild — partial fills accumulate correctly
# ---------------------------------------------------------------------------

def test_rebuild_partial_fills_accumulate():
    """Two fill events for the same order should produce a combined position."""
    store, path = make_store()
    try:
        # Partial fill 1: 6 shares at 2500
        store.record_fill("pf1a", "req-pf1", "WIPRO", "BUY", 6, 2500.0, source="broker_poll")
        # Partial fill 2: remaining 4 shares at 2510
        store.record_fill("pf1b", "req-pf1", "WIPRO", "BUY", 4, 2510.0, source="broker_poll")

        engine = PortfolioEngine(initial_capital=200_000.0)
        summary = rebuild_portfolio_from_fills(store, engine)
        assert summary.total_fills_processed == 2
        assert summary.skipped_rows == 0
        pos = engine.positions.get_position("WIPRO")
        assert pos is not None
        assert pos["quantity"] == 10  # 6 + 4
        # avg_price = (6*2500 + 4*2510) / 10 = 2504
        assert abs(pos["avg_price"] - 2504.0) < 0.01
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 11. Portfolio rebuild — idempotency: second call does not double-count
# ---------------------------------------------------------------------------

def test_rebuild_idempotent():
    store, path = make_store()
    try:
        store.record_fill("idem1", "req-idem", "INFY", "BUY", 5, 1400.0, source="paper")
        engine = PortfolioEngine(initial_capital=50_000.0)
        rebuild_portfolio_from_fills(store, engine)
        summary2 = rebuild_portfolio_from_fills(store, engine)
        # Second call should replay 0 new fills
        assert summary2.total_fills_processed == 0
        pos = engine.positions.get_position("INFY")
        assert pos["quantity"] == 5  # not doubled to 10
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 12. Portfolio rebuild — fallback to order_requests when fill ledger empty
# ---------------------------------------------------------------------------

def test_rebuild_fallback_when_fill_ledger_empty():
    """When order_fills has no rows, should fall back to order_requests FILLED."""
    store, path = make_store()
    try:
        _add_filled_order(store, "req-fb", "SBIN", "BUY", 20, 550.0)
        engine = PortfolioEngine(initial_capital=100_000.0)
        summary = rebuild_portfolio_from_fills(store, engine)
        assert summary.source == "filled_orders_fallback"
        assert summary.total_fills_processed == 1
        pos = engine.positions.get_position("SBIN")
        assert pos is not None
        assert pos["quantity"] == 20
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 13. Portfolio rebuild — BUY then SELL via fill ledger reduces position
# ---------------------------------------------------------------------------

def test_rebuild_buy_then_sell():
    store, path = make_store()
    try:
        store.record_fill("bs1", "req-buy", "TATASTEEL", "BUY", 50, 1000.0)
        store.record_fill("bs2", "req-sell", "TATASTEEL", "SELL", 30, 1050.0)
        engine = PortfolioEngine(initial_capital=500_000.0)
        summary = rebuild_portfolio_from_fills(store, engine)
        assert summary.total_fills_processed == 2
        pos = engine.positions.get_position("TATASTEEL")
        assert pos is not None
        assert pos["quantity"] == 20  # 50 - 30
        # Should have realized PnL
        assert engine.positions.realized_pnl > 0
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 14. Portfolio rebuild — skips rows with missing fill_price
# ---------------------------------------------------------------------------

def test_rebuild_skips_missing_price():
    store, path = make_store()
    try:
        import sqlite3
        # Insert a fill row with fill_price = NULL directly
        conn = sqlite3.connect(path)
        conn.execute(
            "INSERT INTO order_fills (fill_id, request_id, symbol, side, filled_quantity, fill_price, created_at) "
            "VALUES ('bad1', 'req-bad', 'BADCOIN', 'BUY', 5, 0, datetime('now'))"
        )
        conn.commit()
        conn.close()
        engine = PortfolioEngine(initial_capital=100_000.0)
        # fill_price=0 should be skipped
        summary = rebuild_portfolio_from_fills(store, engine)
        assert summary.skipped_rows >= 1
        pos = engine.positions.get_position("BADCOIN")
        assert pos is None
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 15. Portfolio rebuild — legacy DB (no order_fills) falls back gracefully
# ---------------------------------------------------------------------------

def test_rebuild_legacy_db_no_fills_table():
    """If order_fills table does not exist, rebuild should not crash."""
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    import sqlite3
    # Create a minimal legacy DB manually (no order_fills table)
    conn = sqlite3.connect(f.name)
    conn.execute("""
        CREATE TABLE order_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT UNIQUE,
            client_order_id TEXT,
            idempotency_key TEXT UNIQUE,
            symbol TEXT,
            side TEXT,
            quantity INTEGER,
            order_type TEXT,
            mode TEXT,
            status TEXT,
            broker_order_id TEXT,
            reject_reason TEXT,
            avg_fill_price REAL,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.execute(
        "INSERT INTO order_requests (request_id, client_order_id, idempotency_key, symbol, side, "
        "quantity, order_type, mode, status, avg_fill_price, created_at, updated_at) "
        "VALUES ('r1','r1','r1','LEGACY','BUY',10,'MARKET','PAPER','FILLED',100.0,'2025-01-01','2025-01-01')"
    )
    conn.commit()
    conn.close()

    # OrderStore will run migration and CREATE order_fills, but it's empty
    store = OrderStore(f.name)
    engine = PortfolioEngine(initial_capital=100_000.0)
    summary = rebuild_portfolio_from_fills(store, engine)
    # fill ledger empty → fallback to order_requests
    assert summary.source == "filled_orders_fallback"
    assert summary.total_fills_processed == 1
    pos = engine.positions.get_position("LEGACY")
    assert pos is not None
    cleanup(f.name)


# ---------------------------------------------------------------------------
# 16. get_cumulative_filled_quantity — empty request_id returns 0
# ---------------------------------------------------------------------------

def test_cumulative_qty_empty_request_id():
    store, path = make_store()
    try:
        assert store.get_cumulative_filled_quantity("") == 0
        assert store.get_cumulative_filled_quantity("nonexistent-req") == 0
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 17. record_fill — symbols and sides stored uppercase
# ---------------------------------------------------------------------------

def test_record_fill_stores_uppercase():
    store, path = make_store()
    try:
        store.record_fill("upper1", "req-up", "reliance", "buy", 5, 2500.0)
        row = store.get_fills_for_request("req-up")[0]
        assert row["symbol"] == "RELIANCE"
        assert row["side"] == "BUY"
    finally:
        cleanup(path)


# ---------------------------------------------------------------------------
# 18. PaperOrderManager — records fill to ledger on successful paper execution
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_paper_order_manager_records_fill():
    """PaperOrderManager.place_order should write to the fill ledger if order_store provided."""
    store, path = make_store()
    try:
        from backend.core.events import OrderRequestEvent
        from backend.core.types import OrderType, OrderSide, TradingMode
        from backend.execution.paper_order_manager import PaperOrderManager

        # Phase 18K: use allow_after_hours so test passes outside market session.
        cfg = PaperExecutionConfig(allow_after_hours=True)
        manager = PaperOrderManager(order_store=store, config=cfg)
        req = OrderRequestEvent(
            symbol="SBIN",
            side=OrderSide.BUY.value,
            quantity=10,
            order_type=OrderType.MARKET.value,
            price=None,
            strategy_name="test_strat",
            signal_event_id=None,
            trading_mode=TradingMode.PAPER.value,
            source="test",
        )
        market_data = {"ltp": 555.0, "best_ask": 556.0, "spread": 0.5}
        event = await manager.place_order(req, market_data)
        assert event.status == "FILLED"

        # Fill ledger uses event_id as request_id (Phase 18K canonical mapping)
        fills = store.get_fills_for_request(req.event_id)
        assert len(fills) == 1
        assert fills[0]["filled_quantity"] == 10
        assert fills[0]["source"] == "paper"
        assert fills[0]["symbol"] == "SBIN"
    finally:
        cleanup(path)
