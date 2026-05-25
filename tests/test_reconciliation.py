import pytest
import asyncio
import os
import tempfile
import sqlite3
from datetime import datetime, timezone
from dataclasses import asdict
from unittest.mock import AsyncMock, Mock, patch
from fastapi.testclient import TestClient

from backend.core.event_bus import EventBus
from backend.core.events import EventType, SystemHealthEvent, OrderStateEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.execution.order_store import OrderStore
from backend.execution.order_state_machine import OrderStateMachine
from backend.execution.reconciliation import (
    normalize_broker_order_status,
    OrderReconciliationEngine,
    BrokerOrderSnapshot,
    LocalOrderSnapshot,
    OrderReconciliationMismatch,
    OrderReconciliationReport,
)
import backend.api_server as api
from backend.core.config import settings

# Setup FastAPI TestClient
client = TestClient(api.app)

@pytest.fixture
def temp_db_path():
    """Fixture to manage a temporary SQLite database path, ensuring cleanup."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass

@pytest.fixture
def clean_event_bus():
    """Returns a fresh EventBus."""
    return EventBus()

# =====================================================================
# STATUS NORMALIZATION TESTS
# =====================================================================

def test_normalize_broker_order_status_mappings():
    """1. Verify normalization helper maps various broker statuses to unified OMS statuses."""
    # COMPLETE/FILLED
    assert normalize_broker_order_status("COMPLETE") == OrderStatus.FILLED.value
    assert normalize_broker_order_status("FILLED") == OrderStatus.FILLED.value
    assert normalize_broker_order_status("fully_filled") == OrderStatus.FILLED.value

    # REJECTED
    assert normalize_broker_order_status("REJECTED") == OrderStatus.REJECTED.value
    assert normalize_broker_order_status("reject") == OrderStatus.REJECTED.value

    # CANCELLED
    assert normalize_broker_order_status("CANCELLED") == OrderStatus.CANCELLED.value
    assert normalize_broker_order_status("canceled") == OrderStatus.CANCELLED.value

    # OPEN / PARTIAL
    assert normalize_broker_order_status("OPEN") == OrderStatus.OPEN.value
    assert normalize_broker_order_status("TRIGGER PENDING") == OrderStatus.OPEN.value
    assert normalize_broker_order_status("partial") == OrderStatus.OPEN.value
    assert normalize_broker_order_status("PARTIALLY_FILLED") == OrderStatus.OPEN.value
    assert normalize_broker_order_status("ACCEPTED") == OrderStatus.OPEN.value

    # PENDING
    assert normalize_broker_order_status("PENDING") == OrderStatus.PENDING.value
    assert normalize_broker_order_status("VALIDATION_PENDING") == OrderStatus.PENDING.value
    assert normalize_broker_order_status("put_order_req_received") == OrderStatus.PENDING.value

def test_normalize_unknown_status():
    """2. Verify normalization helper returns UNKNOWN for unrecognized statuses, never REJECTED."""
    assert normalize_broker_order_status("INVALID_STATUS_XYZ") == "UNKNOWN"
    assert normalize_broker_order_status("") == "UNKNOWN"
    assert normalize_broker_order_status(None) == "UNKNOWN"
    assert normalize_broker_order_status("UNKNOWN") == "UNKNOWN"

# =====================================================================
# MATCHING LOGIC & RECONCILIATION TESTS
# =====================================================================

@pytest.mark.asyncio
async def test_reconciliation_matches_by_broker_order_id(temp_db_path, clean_event_bus):
    """3. Verify engine matches local and broker orders by broker_order_id."""
    store = OrderStore(temp_db_path)
    # Insert local order
    store.add_order_request(
        request_id="req_1",
        client_order_id="c1",
        idempotency_key="idem_1",
        symbol="SBIN-EQ",
        side="BUY",
        quantity=10,
        order_type="LIMIT",
        mode="PAPER",
        status="OPEN"
    )
    store.update_order_status("req_1", "OPEN", broker_order_id="broker_1")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [
        {"orderid": "broker_1", "status": "COMPLETE", "filledshares": "10", "averageprice": "100.0", "symboltoken": "3045"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    assert len(report.mismatches) == 1
    mismatch = report.mismatches[0]
    assert mismatch.request_id == "req_1"
    assert mismatch.broker_order_id == "broker_1"
    assert mismatch.local_status == "OPEN"
    assert mismatch.broker_status == "FILLED"

@pytest.mark.asyncio
async def test_reconciliation_matches_by_client_order_id(temp_db_path, clean_event_bus):
    """4. Verify engine matches by client_order_id (request_id mapped from broker)."""
    store = OrderStore(temp_db_path)
    store.add_order_request(
        request_id="req_2",
        client_order_id="req_2",
        idempotency_key="idem_2",
        symbol="SBIN-EQ",
        side="BUY",
        quantity=10,
        order_type="LIMIT",
        mode="PAPER",
        status="OPEN"
    )
    # Local has NO broker_order_id yet

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    # Broker row uses request_id as client_order_id or uniqueorderid
    broker_orders = [
        {"orderid": "broker_2", "uniqueorderid": "req_2", "status": "COMPLETE", "filledshares": "10"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    mismatch_types = {m.mismatch_type for m in report.mismatches}
    assert any(t in mismatch_types for t in ("STATUS_MISMATCH", "BROKER_TERMINAL_NOT_PERSISTED"))
    assert "MISSING_BROKER_ORDER_ID" in mismatch_types

@pytest.mark.asyncio
async def test_reconciliation_matches_by_request_id_in_extra_fields(temp_db_path, clean_event_bus):
    """5. Verify engine matches by request_id passed in custom/extra broker attributes."""
    store = OrderStore(temp_db_path)
    store.add_order_request(
        request_id="req_3",
        client_order_id="req_3",
        idempotency_key="idem_3",
        symbol="SBIN-EQ",
        side="BUY",
        quantity=5,
        order_type="MARKET",
        mode="PAPER",
        status="OPEN"
    )

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [
        {"orderid": "broker_3", "client_order_id": "req_3", "status": "COMPLETE", "filledshares": "5"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    assert any(m.request_id == "req_3" for m in report.mismatches)

# =====================================================================
# SEVERITY & MISMATCH CATEGORIZATION TESTS
# =====================================================================

@pytest.mark.asyncio
async def test_mismatch_missing_local_active_order(temp_db_path, clean_event_bus):
    """6. Verify local active missing from broker produces MEDIUM severity mismatch."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_4", "c4", "idem_4", "SBIN-EQ", "BUY", 10, "LIMIT", "PAPER", "OPEN")
    store.update_order_status("req_4", "OPEN", broker_order_id="broker_4")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [] # Empty broker response

    report = engine.reconcile(broker_orders=broker_orders)
    assert len(report.mismatches) == 1
    m = report.mismatches[0]
    assert m.mismatch_type == "MISSING_ON_BROKER"
    assert m.severity == "MEDIUM"

@pytest.mark.asyncio
async def test_mismatch_extra_broker_active_order(temp_db_path, clean_event_bus):
    """7. Verify active broker order missing locally produces HIGH severity mismatch."""
    store = OrderStore(temp_db_path)
    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    # No local orders
    broker_orders = [
        {"orderid": "broker_5", "status": "OPEN", "symboltoken": "3045"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    assert len(report.mismatches) == 1
    m = report.mismatches[0]
    assert m.mismatch_type == "MISSING_LOCALLY"
    assert m.severity == "HIGH"

@pytest.mark.asyncio
async def test_mismatch_status_open_vs_filled(temp_db_path, clean_event_bus):
    """8. Verify status mismatch between OPEN locally and FILLED on broker is HIGH severity."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_6", "c6", "idem_6", "SBIN-EQ", "BUY", 10, "LIMIT", "PAPER", "OPEN")
    store.update_order_status("req_6", "OPEN", broker_order_id="broker_6")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [
        {"orderid": "broker_6", "status": "COMPLETE", "filledshares": "10"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    status_mismatch = next(m for m in report.mismatches if m.mismatch_type in ("STATUS_MISMATCH", "BROKER_TERMINAL_NOT_PERSISTED"))
    assert status_mismatch.severity == "HIGH"

@pytest.mark.asyncio
async def test_mismatch_quantity_difference(temp_db_path, clean_event_bus):
    """9. Verify quantity mismatch produces MEDIUM severity mismatch."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_7", "c7", "idem_7", "SBIN-EQ", "BUY", 100, "LIMIT", "PAPER", "OPEN")
    store.update_order_status("req_7", "OPEN", broker_order_id="broker_7")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    # Broker has quantity 80 (different)
    broker_orders = [
        {"orderid": "broker_7", "status": "OPEN", "filledshares": "80", "quantity": "80"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    qty_mismatch = next(m for m in report.mismatches if m.mismatch_type == "QUANTITY_MISMATCH")
    assert qty_mismatch.severity == "MEDIUM"

@pytest.mark.asyncio
async def test_mismatch_missing_broker_order_id_locally(temp_db_path, clean_event_bus):
    """10. Verify local active missing broker_order_id but matching client_order_id is MEDIUM."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_8", "req_8", "idem_8", "SBIN-EQ", "BUY", 10, "LIMIT", "PAPER", "OPEN")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [
        {"orderid": "broker_8", "uniqueorderid": "req_8", "status": "OPEN", "filledshares": "0"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    missing_id_mismatch = next(m for m in report.mismatches if m.mismatch_type == "MISSING_BROKER_ORDER_ID")
    assert missing_id_mismatch.severity == "MEDIUM"

# =====================================================================
# PERSISTENCE & ACTIONS & DYNAMIC STATE SYNC TESTS
# =====================================================================

@pytest.mark.asyncio
async def test_apply_updates_order_store_status_and_broker_id(temp_db_path, clean_event_bus):
    """11. Verify apply_broker_report updates local database (OrderStore) status and missing broker_order_id."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_9", "req_9", "idem_9", "SBIN-EQ", "BUY", 10, "LIMIT", "PAPER", "OPEN")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [
        {"orderid": "broker_9", "uniqueorderid": "req_9", "status": "COMPLETE", "filledshares": "10"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    assert len(report.mismatches) > 0

    updates = await engine.apply_broker_report(report, broker_orders)
    assert updates > 0

    # Query DB to check updates
    db_order = store.get_order_request("req_9")
    assert db_order["status"] == "FILLED"
    assert db_order["broker_order_id"] == "broker_9"

@pytest.mark.asyncio
async def test_apply_appends_audit_event(temp_db_path, clean_event_bus):
    """12. Verify apply_broker_report appends RECONCILIATION_SYNC log event to order_events."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_10", "req_10", "idem_10", "SBIN-EQ", "BUY", 10, "LIMIT", "PAPER", "OPEN")

    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)
    broker_orders = [
        {"orderid": "broker_10", "uniqueorderid": "req_10", "status": "COMPLETE", "filledshares": "10"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    await engine.apply_broker_report(report, broker_orders)

    # Check order_events table
    events = store.get_order_events("req_10")
    sync_event = next((ev for ev in events if ev["event_type"] == "RECONCILIATION_SYNC" and "FILLED" in ev["status"]), None)
    assert sync_event is not None

@pytest.mark.asyncio
async def test_apply_syncs_in_memory_state_machine(temp_db_path, clean_event_bus):
    """13. Verify apply_broker_report dynamically updates active in-memory OrderStateMachine."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_11", "req_11", "idem_11", "SBIN-EQ", "BUY", 10, "LIMIT", "PAPER", "OPEN")
    store.update_order_status("req_11", "OPEN", broker_order_id="broker_11")

    state_machine = OrderStateMachine(clean_event_bus)
    # Seed state machine in-memory
    state_machine.load_from_store([store.get_order_request("req_11")])
    assert "req_11" in state_machine._orders
    assert state_machine._orders["req_11"].status == OrderStatus.OPEN.value

    engine = OrderReconciliationEngine(store, state_machine, clean_event_bus)
    broker_orders = [
        {"orderid": "broker_11", "status": "COMPLETE", "filledshares": "10"}
    ]

    report = engine.reconcile(broker_orders=broker_orders)
    await engine.apply_broker_report(report, broker_orders)

    # State machine should be updated dynamically
    assert state_machine._orders["req_11"].status == OrderStatus.FILLED.value
    assert state_machine._orders["req_11"].filled_quantity == 10

@pytest.mark.asyncio
async def test_apply_publishes_system_health_event_for_high_severity(temp_db_path, clean_event_bus):
    """14. Verify apply_broker_report publishes SystemHealthEvent for HIGH severity mismatches."""
    store = OrderStore(temp_db_path)
    engine = OrderReconciliationEngine(store, OrderStateMachine(clean_event_bus), clean_event_bus)

    # Missing locally active broker order = HIGH mismatch
    broker_orders = [
        {"orderid": "broker_12", "status": "OPEN", "symboltoken": "3045"}
    ]

    health_events = []
    async def on_health_event(event):
        health_events.append(event)

    clean_event_bus.subscribe(EventType.SYSTEM_HEALTH.value, on_health_event)

    report = engine.reconcile(broker_orders=broker_orders)
    await engine.apply_broker_report(report, broker_orders)

    # Give event loop a microsecond to dispatch the async publish task
    await asyncio.sleep(0.01)

    assert len(health_events) == 1
    ev = health_events[0]
    assert ev.component == "order_reconciliation"
    assert ev.status == "ERROR"
    assert "missing_locally" in ev.metrics["mismatch_type"].lower()

# =====================================================================
# API ROUTE INTEGRATION TESTS
# =====================================================================

def test_api_route_verification_and_response_sanitization(temp_db_path):
    """15. Verify POST /portfolio/reconcile/orders token check, execution flow, and sanitized output."""
    # Test unauthorized (no token)
    with patch.object(settings, "admin_token", "super_secret_admin_token"):
        response = client.post("/portfolio/reconcile/orders", json=[])
        assert response.status_code == 403

        # Test success with correct token
        mock_router = Mock()
        mock_router.order_store = OrderStore(temp_db_path)
        mock_router.order_state_machine = OrderStateMachine(EventBus())
        mock_router.event_bus = EventBus()

        with patch.dict(api.app.state.__dict__, {"execution_router": mock_router, "session_manager": Mock(is_valid=True)}):
            # Pass mock broker orders in request body
            broker_orders = [
                {
                    "broker_order_id": "broker_secret_token",
                    "status": "COMPLETE",
                    "filled_quantity": 10,
                }
            ]
            with patch("dataclasses.asdict") as mock_asdict:
                mock_asdict.return_value = {
                    "checked_at": "2026-05-25T18:43:21",
                    "local_active_count": 0,
                    "broker_order_count": 0,
                    "matched_count": 0,
                    "mismatch_count": 0,
                    "mismatches": [],
                    "secret_token_credential": "my_secret_key" # sensitive key to trigger redaction
                }
                response = client.post(
                    "/portfolio/reconcile/orders",
                    json=broker_orders,
                    headers={"X-Admin-Token": "super_secret_admin_token"}
                )
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "success"
                
                # Response should be sanitized recursively
                report_str = str(data)
                assert "my_secret_key" not in report_str
                assert "***REDACTED***" in report_str
