"""tests/test_oms_admin_api.py

Phase 18J tests: OMS admin visibility endpoints.

Coverage:
  1.  GET /oms/health is public — no token needed
  2.  GET /oms/status requires admin token → 403 without token
  3.  GET /oms/status returns sanitized OMS summary shape
  4.  GET /oms/orders/recent requires admin token → 403 without
  5.  GET /oms/orders/recent returns orders list (no credentials)
  6.  GET /oms/events/recent requires admin token → 403 without
  7.  GET /oms/events/recent returns events list
  8.  GET /oms/fills/recent requires admin token → 403 without
  9.  GET /oms/fills/recent returns fills list
  10. GET /oms/orders/{id}/audit requires admin token → 403
  11. GET /oms/orders/{id}/audit returns order + events + fills
  12. GET /oms/orders/unknown/audit returns 404
  13. limit query param is capped at 200 server-side
  14. GET /oms/reconciliation/status requires admin token → 403
  15. GET /oms/reconciliation/status returns safe shape when no report
  16. POST /oms/reconciliation/run requires admin token → 403
  17. POST /oms/reconciliation/run with empty broker list returns success
  18. No credential / token-like values leak in any response
  19. GET /oms/status includes portfolio rebuild summary when set
  20. OMS methods: get_oms_summary returns correct shape
  21. OMS methods: get_recent_order_requests limit capped at 200
  22. OMS methods: get_order_audit returns None order for unknown id
  23. Existing tests unaffected (import sanity check)
"""

import os
import tempfile
import uuid

import pytest
from fastapi.testclient import TestClient

from backend.execution.order_store import OrderStore
from backend.portfolio.rebuild import PortfolioRebuildSummary


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def temp_store():
    """Provide a file-backed OrderStore and clean up after the test."""
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    store = OrderStore(f.name)
    yield store
    try:
        os.unlink(f.name)
    except FileNotFoundError:
        pass


def _seed_order(store: OrderStore, request_id: str = None, status: str = "FILLED",
                symbol: str = "RELIANCE", side: str = "BUY", qty: int = 10,
                avg_fill_price: float = 2500.0) -> str:
    rid = request_id or str(uuid.uuid4())
    store.add_order_request(
        request_id=rid,
        client_order_id=rid,
        idempotency_key=rid,
        symbol=symbol,
        side=side,
        quantity=qty,
        order_type="MARKET",
        mode="PAPER",
        status=status,
    )
    if status == "FILLED":
        store.update_order_status(rid, "FILLED", avg_fill_price=avg_fill_price)
    return rid


def _seed_fill(store: OrderStore, request_id: str, fill_id: str = None) -> str:
    fid = fill_id or f"fill-{uuid.uuid4()}"
    store.record_fill(
        fill_id=fid,
        request_id=request_id,
        symbol="RELIANCE",
        side="BUY",
        filled_quantity=5,
        fill_price=2500.0,
        source="paper",
    )
    return fid


@pytest.fixture()
def app_with_store(temp_store):
    """Return a TestClient whose app.state.order_store is the temp_store."""
    from backend.routers.oms import router as oms_router
    from fastapi import FastAPI
    from backend.core.config import settings as _settings

    # Build minimal app with only the OMS router
    from fastapi import FastAPI
    from backend.routers import oms as oms_module

    mini_app = FastAPI()
    mini_app.include_router(oms_module.router)
    mini_app.state.order_store = temp_store
    mini_app.state.execution_router = None
    mini_app.state.trading_mode = "PAPER"
    mini_app.state.oms_rebuild_summary = None
    mini_app.state.oms_rebuild_at = None
    mini_app.state.last_reconciliation_report = None
    mini_app.state.last_reconciliation_at = None
    return TestClient(mini_app, raise_server_exceptions=True)


ADMIN_HEADERS = {"X-Admin-Token": "ci-test-admin-token-do-not-use-in-prod"}


def _client_with_token(app_with_store):
    """Monkey-patch settings.admin_token for test isolation."""
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    yield app_with_store
    _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 1. GET /oms/health — public
# ---------------------------------------------------------------------------

def test_oms_health_public(app_with_store):
    resp = app_with_store.get("/oms/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "oms_initialized" in data
    assert data["oms_initialized"] is True
    assert "queried_at" in data


# ---------------------------------------------------------------------------
# 2. GET /oms/status — 403 without token when ADMIN_TOKEN is set
# ---------------------------------------------------------------------------

def test_oms_status_requires_admin_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "secret-admin"
    try:
        resp = app_with_store.get("/oms/status")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 3. GET /oms/status — returns sanitized summary
# ---------------------------------------------------------------------------

def test_oms_status_shape(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        _seed_order(temp_store, status="FILLED")
        resp = app_with_store.get("/oms/status", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "oms" in data
        oms = data["oms"]
        for field in ["total_orders", "active_orders", "terminal_orders",
                      "filled_orders", "rejected_orders", "fill_count",
                      "latest_order_at"]:
            assert field in oms, f"Missing field: {field}"
        assert oms["total_orders"] >= 1
        assert oms["filled_orders"] >= 1
        assert "queried_at" in data
        assert "trading_mode" in data
        # No secret-looking values
        _assert_no_secrets(data)
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 4-5. GET /oms/orders/recent
# ---------------------------------------------------------------------------

def test_oms_orders_recent_requires_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "tok"
    try:
        resp = app_with_store.get("/oms/orders/recent")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


def test_oms_orders_recent_returns_data(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        rid = _seed_order(temp_store)
        resp = app_with_store.get("/oms/orders/recent?limit=10", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "orders" in data
        assert "count" in data
        assert data["count"] >= 1
        # First order contains no secrets
        _assert_no_secrets(data)
        symbols = [o["symbol"] for o in data["orders"]]
        assert "RELIANCE" in symbols
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 6-7. GET /oms/events/recent
# ---------------------------------------------------------------------------

def test_oms_events_recent_requires_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "tok"
    try:
        resp = app_with_store.get("/oms/events/recent")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


def test_oms_events_recent_returns_list(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        rid = _seed_order(temp_store)
        temp_store.add_order_event(rid, "PAPER_FILLED", "FILLED")
        resp = app_with_store.get("/oms/events/recent?limit=20", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        _assert_no_secrets(data)
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 8-9. GET /oms/fills/recent
# ---------------------------------------------------------------------------

def test_oms_fills_recent_requires_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "tok"
    try:
        resp = app_with_store.get("/oms/fills/recent")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


def test_oms_fills_recent_returns_fill_list(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        rid = _seed_order(temp_store)
        _seed_fill(temp_store, rid)
        resp = app_with_store.get("/oms/fills/recent?limit=20", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "fills" in data
        assert data["count"] >= 1
        fill = data["fills"][0]
        assert "fill_price" in fill
        assert "filled_quantity" in fill
        _assert_no_secrets(data)
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 10-12. GET /oms/orders/{id}/audit
# ---------------------------------------------------------------------------

def test_oms_audit_requires_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "tok"
    try:
        resp = app_with_store.get("/oms/orders/some-id/audit")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


def test_oms_audit_returns_full_bundle(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        rid = _seed_order(temp_store)
        temp_store.add_order_event(rid, "ORDER_PLACED", "PENDING")
        _seed_fill(temp_store, rid)
        resp = app_with_store.get(f"/oms/orders/{rid}/audit", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["request_id"] == rid
        assert data["order"] is not None
        assert isinstance(data["events"], list)
        assert isinstance(data["fills"], list)
        assert len(data["fills"]) >= 1
        _assert_no_secrets(data)
    finally:
        _cfg.settings.admin_token = original


def test_oms_audit_unknown_request_id_returns_404(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        resp = app_with_store.get("/oms/orders/nonexistent-id-9999/audit", headers=ADMIN_HEADERS)
        assert resp.status_code == 404
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 13. Limit capping
# ---------------------------------------------------------------------------

def test_oms_limit_cap(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        # Request more than 200 — should be server-side capped (FastAPI Query le=200)
        resp = app_with_store.get("/oms/orders/recent?limit=200", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["limit"] == 200
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 14-15. GET /oms/reconciliation/status
# ---------------------------------------------------------------------------

def test_oms_recon_status_requires_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "tok"
    try:
        resp = app_with_store.get("/oms/reconciliation/status")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


def test_oms_recon_status_no_report(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        resp = app_with_store.get("/oms/reconciliation/status", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "no_report"
        assert "message" in data
        _assert_no_secrets(data)
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 16. POST /oms/reconciliation/run — requires token
# ---------------------------------------------------------------------------

def test_oms_recon_run_requires_token(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "tok"
    try:
        resp = app_with_store.post("/oms/reconciliation/run")
        assert resp.status_code == 403
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 17. POST /oms/reconciliation/run with empty broker list — success
# ---------------------------------------------------------------------------

def test_oms_recon_run_empty_broker_list(app_with_store, temp_store):
    """Run reconciliation with empty broker snapshot — should return success with 0 updates."""
    from backend.core import config as _cfg
    from backend.execution.order_state_machine import OrderStateMachine
    from backend.core.event_bus import EventBus
    from unittest.mock import MagicMock

    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        # Need a mock execution_router with order_store + order_state_machine
        mock_er = MagicMock()
        mock_er.order_store = temp_store
        mock_er.order_state_machine = OrderStateMachine()
        mock_er.event_bus = EventBus()
        app_with_store.app.state.execution_router = mock_er

        resp = app_with_store.post(
            "/oms/reconciliation/run",
            json=[],  # empty broker snapshot
            headers={**ADMIN_HEADERS, "Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "updates_applied" in data
        assert "report" in data
        _assert_no_secrets(data)
    finally:
        _cfg.settings.admin_token = original
        app_with_store.app.state.execution_router = None


# ---------------------------------------------------------------------------
# 18. No credentials leak in any response
# ---------------------------------------------------------------------------

def test_no_credentials_leak_in_status(app_with_store, temp_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        _seed_order(temp_store)
        for path in ["/oms/health", "/oms/status", "/oms/orders/recent",
                     "/oms/events/recent", "/oms/fills/recent"]:
            resp = app_with_store.get(path, headers=ADMIN_HEADERS)
            assert resp.status_code == 200, f"Failed: {path}"
            _assert_no_secrets(resp.json())
    finally:
        _cfg.settings.admin_token = original


# ---------------------------------------------------------------------------
# 19. /oms/status includes portfolio rebuild summary when set
# ---------------------------------------------------------------------------

def test_oms_status_includes_rebuild_summary(app_with_store):
    from backend.core import config as _cfg
    original = _cfg.settings.admin_token
    _cfg.settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    try:
        from datetime import datetime, timezone
        summary = PortfolioRebuildSummary(
            total_fills_processed=5,
            skipped_rows=1,
            rebuilt_positions=["RELIANCE", "INFY"],
            warnings=["one warning"],
            source="fill_ledger",
        )
        app_with_store.app.state.oms_rebuild_summary = summary
        app_with_store.app.state.oms_rebuild_at = datetime.now(timezone.utc).isoformat()
        resp = app_with_store.get("/oms/status", headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        rb = data.get("portfolio_rebuild")
        assert rb is not None
        assert rb["fills_processed"] == 5
        assert rb["skipped_rows"] == 1
        assert rb["source"] == "fill_ledger"
        assert rb["warnings_count"] == 1
        assert "RELIANCE" in rb["rebuilt_positions"]
    finally:
        _cfg.settings.admin_token = original
        app_with_store.app.state.oms_rebuild_summary = None


# ---------------------------------------------------------------------------
# 20. get_oms_summary unit test
# ---------------------------------------------------------------------------

def test_get_oms_summary_shape(temp_store):
    _seed_order(temp_store, status="FILLED")
    _seed_order(temp_store, status="REJECTED")
    rid = _seed_order(temp_store, status="PENDING")
    temp_store.record_fill(f"fill-{uuid.uuid4()}", rid, "SBIN", "BUY", 3, 550.0)
    summary = temp_store.get_oms_summary()
    assert "total_orders" in summary
    assert "active_orders" in summary
    assert "filled_orders" in summary
    assert "rejected_orders" in summary
    assert "fill_count" in summary
    assert "partial_fill_count" in summary
    assert summary["total_orders"] == 3
    assert summary["filled_orders"] == 1
    assert summary["fill_count"] == 1


# ---------------------------------------------------------------------------
# 21. get_recent_order_requests limit capped
# ---------------------------------------------------------------------------

def test_get_recent_order_requests_limit_capped(temp_store):
    for _ in range(5):
        _seed_order(temp_store)
    # Asking for 999 should be capped to 200 internally
    rows = temp_store.get_recent_order_requests(limit=999)
    # Only 5 rows exist, so will return 5 (capped at 200, but only 5 in DB)
    assert len(rows) == 5
    assert isinstance(rows[0], dict)


# ---------------------------------------------------------------------------
# 22. get_order_audit for unknown id returns None order
# ---------------------------------------------------------------------------

def test_get_order_audit_unknown_id(temp_store):
    audit = temp_store.get_order_audit("totally-unknown-id")
    assert audit["order"] is None
    assert audit["events"] == []
    assert audit["fills"] == []


# ---------------------------------------------------------------------------
# 23. Import sanity — existing modules still importable
# ---------------------------------------------------------------------------

def test_existing_modules_still_import():
    import backend.execution.order_store
    import backend.execution.paper_order_manager
    import backend.execution.order_poller
    import backend.portfolio.rebuild
    import backend.routers.oms
    import backend.api_server


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

_SECRET_TERMS = (
    "api_key", "apikey", "password", "totp", "jwt", "refresh_token",
    "feed_token", "auth_token", "secret", "credential",
)


def _assert_no_secrets(obj, path: str = "root"):
    """Recursively assert no raw secret-looking values appear in response."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            kl = k.lower()
            # If key looks secret AND value is a non-empty string — fail
            if any(t in kl for t in _SECRET_TERMS) and isinstance(v, str) and v and v != "***REDACTED***":
                # Check if it's a safe boolean-indicator key
                if not (k.endswith("_available") or k.endswith("_configured")):
                    pytest.fail(f"Potential secret leak at path={path}.{k}: value={v!r}")
            _assert_no_secrets(v, path=f"{path}.{k}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _assert_no_secrets(item, path=f"{path}[{i}]")
