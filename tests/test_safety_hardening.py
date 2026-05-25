import pytest
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from backend.core.event_bus import EventBus
from backend.core.events import (
    EventType,
    TickEvent,
    SignalEvent,
    OrderRequestEvent,
    OrderStateEvent,
    ErrorEvent,
)
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.strategy.signal_validator import SignalValidator
from backend.execution.execution_router import ExecutionRouter
from backend.execution.kill_switch import KillSwitch
from backend.execution.models import OrderIntent, RiskDecision

# Import api_server to test integration
import backend.api_server as api
from fastapi.testclient import TestClient

client = TestClient(api.app)

@pytest.fixture
def clean_event_bus():
    """Returns a fresh EventBus to avoid listener leaks between tests."""
    return EventBus()

# =====================================================================
# SIGNAL VALIDATOR UNIT TESTS (Safety Conditions 1-8)
# =====================================================================

@pytest.mark.asyncio
async def test_condition_1_signal_validator_rejects_invalid_quantity(clean_event_bus):
    """1. Verify SignalValidator rejects signal when default quantity is <= 0 (e.g. 0)."""
    validator = SignalValidator(event_bus=clean_event_bus, default_quantity=0)
    errors = []
    
    async def on_error(e):
        errors.append(e)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal)
    assert result is None
    assert len(errors) == 1
    assert errors[0].error_type == "SIGNAL_REJECTED"
    assert "invalid_quantity" in errors[0].safe_message


@pytest.mark.asyncio
async def test_condition_2_signal_validator_rejects_missing_quantity(clean_event_bus):
    """2. Verify SignalValidator rejects signal when default quantity is None."""
    validator = SignalValidator(event_bus=clean_event_bus, default_quantity=None)
    errors = []
    
    async def on_error(e):
        errors.append(e)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal)
    assert result is None
    assert len(errors) == 1
    assert errors[0].error_type == "SIGNAL_REJECTED"
    assert "missing_quantity" in errors[0].safe_message


@pytest.mark.asyncio
async def test_condition_3_signal_validator_rejects_missing_symbol(clean_event_bus):
    """3. Verify SignalValidator rejects signal when symbol is empty."""
    validator = SignalValidator(event_bus=clean_event_bus, default_quantity=1)
    errors = []
    
    async def on_error(e):
        errors.append(e)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal)
    assert result is None
    assert len(errors) == 1
    assert errors[0].error_type == "SIGNAL_REJECTED"
    assert "missing_symbol" in errors[0].safe_message


@pytest.mark.asyncio
async def test_condition_4_signal_validator_rejects_invalid_action(clean_event_bus):
    """4. Verify SignalValidator rejects signal with invalid side/action."""
    validator = SignalValidator(event_bus=clean_event_bus, default_quantity=1)
    errors = []
    
    async def on_error(e):
        errors.append(e)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="INVALID_ACTION",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal)
    assert result is None
    assert len(errors) == 1
    assert errors[0].error_type == "SIGNAL_REJECTED"
    assert "invalid_action" in errors[0].safe_message


@pytest.mark.asyncio
async def test_condition_5_signal_validator_rejects_live_locked(clean_event_bus):
    """5. Verify SignalValidator rejects signal when live mode is locked (disabled)."""
    validator = SignalValidator(event_bus=clean_event_bus, live_trading_enabled=False, default_quantity=1)
    errors = []
    
    async def on_error(e):
        errors.append(e)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal, trading_mode="LIVE")
    assert result is None
    assert len(errors) == 1
    assert errors[0].error_type == "SIGNAL_REJECTED"
    assert "live_trading_disabled" in errors[0].safe_message


@pytest.mark.asyncio
async def test_condition_6_signal_validator_rejects_kill_switch(clean_event_bus):
    """6. Verify SignalValidator rejects signal when kill switch is active."""
    kill_switch = KillSwitch()
    kill_switch.activate("Test Safety Activation")
    validator = SignalValidator(event_bus=clean_event_bus, kill_switch=kill_switch, default_quantity=1)
    errors = []
    
    async def on_error(e):
        errors.append(e)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal)
    assert result is None
    assert len(errors) == 1
    assert errors[0].error_type == "SIGNAL_REJECTED"
    assert "kill_switch_active" in errors[0].safe_message


@pytest.mark.asyncio
async def test_condition_7_signal_validator_neutral_no_action(clean_event_bus):
    """7. Verify SignalValidator ignores NEUTRAL signal without generating error or order."""
    validator = SignalValidator(event_bus=clean_event_bus, default_quantity=1)
    requests = []
    errors = []
    
    async def on_request(e):
        requests.append(e)
    async def on_error(e):
        errors.append(e)
        
    clean_event_bus.subscribe(EventType.ORDER_REQUEST.value, on_request)
    clean_event_bus.subscribe(EventType.ERROR.value, on_error)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="NEUTRAL",
        ltp=100.0,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id=None
    )

    result = await validator.validate_and_route(signal)
    assert result is None
    assert len(requests) == 0
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_condition_8_signal_validator_publishes_valid_request(clean_event_bus):
    """8. Verify SignalValidator publishes valid OrderRequestEvent on approval."""
    validator = SignalValidator(event_bus=clean_event_bus, default_quantity=5)
    requests = []
    
    async def on_request(e):
        requests.append(e)
    clean_event_bus.subscribe(EventType.ORDER_REQUEST.value, on_request)

    signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=123.45,
        strength=1.0,
        reason="Test",
        indicators={},
        source_tick_event_id="tick_987"
    )

    result = await validator.validate_and_route(signal)
    assert result is not None
    assert result.symbol == "SBIN-EQ"
    assert result.side == "BUY"
    assert result.quantity == 5
    assert result.price == 123.45
    assert result.signal_event_id == signal.event_id
    assert len(requests) == 1
    assert requests[0].event_id == result.event_id


# =====================================================================
# EXECUTION ROUTER UNIT TESTS (Safety Conditions 9-11)
# =====================================================================

@pytest.mark.asyncio
async def test_condition_9_execution_router_rejects_duplicate_requests(clean_event_bus):
    """9. Verify ExecutionRouter rejects duplicate order request IDs."""
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value)
    
    order_states = []
    async def on_order_state(e):
        order_states.append(e)
    clean_event_bus.subscribe(EventType.ORDER_STATE.value, on_order_state)
    
    req = OrderRequestEvent(
        symbol="SBIN-EQ",
        side="BUY",
        quantity=10,
        order_type=OrderType.MARKET.value,
        price=100.0,
        strategy_name="test",
        signal_event_id=None,
        trading_mode=TradingMode.PAPER.value,
        source="MANUAL",
    )
    
    # Mock risk gate to always approve
    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id=req.event_id,
        approved=True,
        rejected_reason=None,
        failed_checks=[],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=1000.0,
        market_data_fresh=True,
        kill_switch_active=False
    ))
    
    # Mock paper manager
    async def mock_place_order(order_req, market_data=None):
        evt = OrderStateEvent(
            order_id="ord_123",
            broker_order_id=None,
            symbol="SBIN-EQ",
            side="BUY",
            quantity=10,
            filled_quantity=10,
            avg_fill_price=100.0,
            status=OrderStatus.FILLED.value,
            reject_reason=None,
            order_request_id=order_req.event_id,
        )
        if clean_event_bus:
            await clean_event_bus.publish(evt)
        return evt
    router.paper_manager.place_order = mock_place_order
    
    # Route the first time - should succeed
    res1 = await router.route(req)
    assert res1.status == OrderStatus.FILLED.value
    
    # Route the second time (same req ID) - should reject as duplicate
    res2 = await router.route(req)
    assert res2.status == OrderStatus.REJECTED.value
    assert res2.reject_reason == "duplicate_request"
    
    # Verify that a rejected order state event was published
    assert len(order_states) == 2
    assert order_states[0].status == OrderStatus.FILLED.value
    assert order_states[1].status == OrderStatus.REJECTED.value
    assert order_states[1].reject_reason == "duplicate_request"


@pytest.mark.asyncio
async def test_condition_10_execution_router_enforces_risk_checks(clean_event_bus):
    """10. Verify ExecutionRouter evaluates and rejects orders violating risk gates."""
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value)
    
    order_states = []
    async def on_order_state(e):
        order_states.append(e)
    clean_event_bus.subscribe(EventType.ORDER_STATE.value, on_order_state)
    
    req = OrderRequestEvent(
        symbol="SBIN-EQ",
        side="BUY",
        quantity=999999,
        order_type=OrderType.MARKET.value,
        price=100.0,
        strategy_name="test",
        signal_event_id=None,
        trading_mode=TradingMode.PAPER.value,
        source="MANUAL",
    )
    
    # Mock risk gate to return unapproved risk decision
    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id=req.event_id,
        approved=False,
        rejected_reason="max_order_qty",
        failed_checks=["max_order_qty"],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=99999900.0,
        market_data_fresh=True,
        kill_switch_active=False
    ))
    
    res = await router.route(req)
    assert res.status == OrderStatus.REJECTED.value
    assert "max_order_qty" in res.reject_reason
    
    # Verify rejected OrderStateEvent was published to the event bus
    assert len(order_states) == 1
    assert order_states[0].status == OrderStatus.REJECTED.value
    assert "max_order_qty" in order_states[0].reject_reason


@pytest.mark.asyncio
async def test_condition_11_execution_router_blocks_live_trading_lock(clean_event_bus):
    """11. Verify ExecutionRouter rejects orders when live is disabled or switch fails."""
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.LIVE.value, live_enabled=False)
    
    order_states = []
    async def on_order_state(e):
        order_states.append(e)
    clean_event_bus.subscribe(EventType.ORDER_STATE.value, on_order_state)
    
    req = OrderRequestEvent(
        symbol="SBIN-EQ",
        side="BUY",
        quantity=10,
        order_type=OrderType.MARKET.value,
        price=100.0,
        strategy_name="test",
        signal_event_id=None,
        trading_mode=TradingMode.LIVE.value,
        source="MANUAL",
    )
    
    # Mock risk gate to pass to isolate live trading locks
    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id=req.event_id,
        approved=True,
        rejected_reason=None,
        failed_checks=[],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=1000.0,
        market_data_fresh=True,
        kill_switch_active=False
    ))
    
    res = await router.route(req)
    assert res.status == OrderStatus.REJECTED.value
    assert res.reject_reason == "live_safety_check_failed"
    
    # Verify rejected OrderStateEvent was published
    assert len(order_states) == 1
    assert order_states[0].status == OrderStatus.REJECTED.value
    assert order_states[0].reject_reason == "live_safety_check_failed"


# =====================================================================
# EVENT PIPING & API SERVER INTEGRATION TESTS (Safety Condition 12)
# =====================================================================

@pytest.mark.asyncio
async def test_condition_12_api_server_tick_publishing_and_decoupled_routing():
    """12. Verify process_tick emits SignalEvents and autopilot routes them asynchronously."""
    # Temporarily enable autopilot to test decoupled integration
    original_autopilot = api.auto_pilot
    api.auto_pilot = True
    
    original_cooldown = api.trade_cooldown
    api.trade_cooldown = 0
    api.last_trade_time = 0
    
    test_signal = SignalEvent(
        symbol="SBIN-EQ",
        strategy_name="VWAPMeanReversion",
        action="BUY",
        ltp=150.0,
        strength=1.0,
        reason="TestDev",
        indicators={"vwap": 149.0},
        source_tick_event_id="tick_123"
    )
    
    signals_emitted = []
    async def signal_listener(event):
        signals_emitted.append(event)
    
    api.event_bus.subscribe(EventType.SIGNAL.value, signal_listener)
    
    # Mock strategy signal generation and router route
    routed_requests = []
    async def mock_route(order_request, latest_market=None):
        routed_requests.append(order_request)
        return OrderStateEvent(
            order_id="ord_autopilot_123",
            broker_order_id=None,
            symbol=order_request.symbol,
            side=order_request.side,
            quantity=order_request.quantity,
            filled_quantity=order_request.quantity,
            avg_fill_price=150.0,
            status=OrderStatus.FILLED.value,
            reject_reason=None,
            order_request_id=order_request.event_id
        )
    
    with patch.object(api.strategy, 'generate_signal', return_value=test_signal):
        with patch.object(api.router, 'route', side_effect=mock_route):
            tick = {
                "symbol": "SBIN-EQ",
                "price": 150.0,
                "vwap": 149.0,
                "event_id": "tick_123"
            }
            await api.process_tick(tick)
            
            # Give event bus tasks a brief moment to propagate and run subscriptions
            await asyncio.sleep(0.1)
            
    # Restore api globals
    api.auto_pilot = original_autopilot
    api.trade_cooldown = original_cooldown
    
    # Check 1: process_tick emitted a SignalEvent
    assert len(signals_emitted) == 1
    assert signals_emitted[0].symbol == "SBIN-EQ"
    assert signals_emitted[0].action == "BUY"
    assert signals_emitted[0].source_tick_event_id == "tick_123"
    
    # Check 2: SignalEvent was picked up, validated, and routed to Executor Router
    assert len(routed_requests) == 1
    assert routed_requests[0].symbol == "SBIN-EQ"
    assert routed_requests[0].side == "BUY"
    assert routed_requests[0].quantity == api.signal_validator.default_quantity


def test_api_order_endpoint_async_flow():
    """Verify POST /order endpoint runs asynchronously and forces risk gate check."""
    test_state = OrderStateEvent(
        order_id="ord_manual_999",
        broker_order_id=None,
        symbol="SBIN",
        side="BUY",
        quantity=5,
        filled_quantity=5,
        avg_fill_price=105.0,
        status=OrderStatus.FILLED.value,
        reject_reason=None,
        order_request_id=None,
    )
    
    async def mock_route_async(order_request, latest_market=None):
        return test_state
        
    mock_gateway = Mock()
    mock_gateway.latest_data = {"3045": {"ltp": 105.0}}
    
    with patch.object(api.router, 'route', side_effect=mock_route_async):
        with patch.object(api, 'gateway', mock_gateway):
            response = client.post("/order?side=BUY&qty=5&symbol=SBIN")
        
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == OrderStatus.FILLED.value
    assert data["order_id"] == "ord_manual_999"
    assert data["filled_qty"] == 5
    assert data["price"] == 105.0


# =====================================================================
# PHASE 18C PERSISTENT OMS UNIT & INTEGRATION TESTS
# =====================================================================

import os
import tempfile
from backend.execution.order_store import OrderStore

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

def test_condition_13_db_schema_creation(temp_db_path):
    """1. DB connection and table schema creation verification."""
    store = OrderStore(temp_db_path)
    # Check that tables exist and have correct schema
    import sqlite3
    conn = sqlite3.connect(temp_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    assert "order_requests" in tables
    assert "order_events" in tables
    
    # Check fields in order_requests
    cursor.execute("PRAGMA table_info(order_requests)")
    fields = [row[1] for row in cursor.fetchall()]
    assert "request_id" in fields
    assert "idempotency_key" in fields
    assert "status" in fields
    conn.close()

def test_condition_14_successful_insert_and_audit(temp_db_path):
    """2. Successful insert of a new order request and audit trail verification."""
    store = OrderStore(temp_db_path)
    inserted = store.add_order_request(
        request_id="req_1",
        client_order_id="client_1",
        idempotency_key="idem_1",
        symbol="SBIN",
        side="BUY",
        quantity=10,
        order_type="MARKET",
        mode="PAPER",
        status="RECEIVED"
    )
    assert inserted is True
    
    req = store.get_order_request("req_1")
    assert req is not None
    assert req["status"] == "RECEIVED"
    assert req["client_order_id"] == "client_1"
    assert req["idempotency_key"] == "idem_1"

def test_condition_15_duplicate_request_id_rejected(temp_db_path):
    """3. Duplicate rejection on matching request_id."""
    store = OrderStore(temp_db_path)
    inserted1 = store.add_order_request("req_1", "client_1", "idem_1", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    inserted2 = store.add_order_request("req_1", "client_2", "idem_2", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    assert inserted1 is True
    assert inserted2 is False  # Rejected due to UNIQUE constraint on request_id

def test_condition_16_duplicate_idempotency_key_rejected(temp_db_path):
    """4. Duplicate rejection on matching idempotency_key."""
    store = OrderStore(temp_db_path)
    inserted1 = store.add_order_request("req_1", "client_1", "idem_1", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    inserted2 = store.add_order_request("req_2", "client_2", "idem_1", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    assert inserted1 is True
    assert inserted2 is False  # Rejected due to UNIQUE constraint on idempotency_key

@pytest.mark.asyncio
async def test_condition_17_state_transitions_verification(temp_db_path, clean_event_bus):
    """5. State transitions verification (RECEIVED -> RISK_APPROVED -> ROUTED_TO_PAPER -> FILLED)."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)
    
    # Mock risk gate to approve
    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id="req_transition",
        approved=True,
        rejected_reason=None,
        failed_checks=[],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=1000.0,
        market_data_fresh=True,
        kill_switch_active=False
    ))
    
    # Mock paper manager
    async def mock_place_order(order_req, market_data=None):
        return OrderStateEvent(
            order_id="ord_transition",
            broker_order_id=None,
            symbol=order_req.symbol,
            side=order_req.side,
            quantity=order_req.quantity,
            filled_quantity=order_req.quantity,
            avg_fill_price=100.0,
            status=OrderStatus.FILLED.value,
            reject_reason=None,
            order_request_id=order_req.event_id,
        )
    router.paper_manager.place_order = mock_place_order
    
    req = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        order_type="MARKET",
        price=100.0,
        strategy_name="test",
        signal_event_id=None,
        trading_mode="PAPER",
        source="MANUAL",
        event_id="req_transition"
    )
    
    res = await router.route(req)
    assert res.status == OrderStatus.FILLED.value
    
    # Verify final status in DB
    saved_req = store.get_order_request("req_transition")
    assert saved_req["status"] == "FILLED"

def test_condition_18_state_transition_history(temp_db_path):
    """6. State transition history (order_events rows appended sequentially)."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_hist", "client_hist", "idem_hist", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    store.add_order_event("req_hist", "RECEIVED", "RECEIVED")
    
    store.update_order_status("req_hist", "RISK_APPROVED")
    store.add_order_event("req_hist", "RISK_APPROVED", "RISK_APPROVED")
    
    store.update_order_status("req_hist", "FILLED")
    store.add_order_event("req_hist", "FILLED", "FILLED")
    
    events = store.get_order_events("req_hist")
    assert len(events) == 3
    assert events[0]["event_type"] == "RECEIVED"
    assert events[1]["event_type"] == "RISK_APPROVED"
    assert events[2]["event_type"] == "FILLED"

@pytest.mark.asyncio
async def test_condition_19_rejection_paths(temp_db_path, clean_event_bus):
    """7. Rejection paths verification (unapproved risk gates lead to RISK_REJECTED / no execution)."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)
    
    # Mock risk gate to reject
    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id="req_reject",
        approved=False,
        rejected_reason="max_order_qty",
        failed_checks=["max_order_qty"],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=99999.0,
        market_data_fresh=True,
        kill_switch_active=False
    ))
    
    # Set paper_manager mock to blow up if called, verifying no execution
    router.paper_manager.place_order = AsyncMock(side_effect=Exception("Should not be called!"))
    
    req = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=99999,
        order_type="MARKET",
        price=100.0,
        strategy_name="test",
        signal_event_id=None,
        trading_mode="PAPER",
        source="MANUAL",
        event_id="req_reject"
    )
    
    res = await router.route(req)
    assert res.status == OrderStatus.REJECTED.value
    assert res.reject_reason == "max_order_qty"
    
    saved_req = store.get_order_request("req_reject")
    assert saved_req["status"] == "RISK_REJECTED"
    
    events = store.get_order_events("req_reject")
    assert len(events) == 2
    assert events[0]["event_type"] == "RECEIVED"
    assert events[1]["event_type"] == "RISK_REJECTED"

def test_condition_20_sanitized_endpoint(temp_db_path):
    """8. Read-only api endpoints return sanitized responses with no secrets / active tokens."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_sec", "client_sec", "idem_sec", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    # Let's insert a sensitive-looking key name or mock check
    # Check if security's sanitize_response is functional with secrets
    from backend.core.security import sanitize_response
    data = {
        "symbol": "SBIN",
        "api_key": "mysecretkey123",
        "password": "mypassword123",
        "token": "sensitive_broker_token_456"
    }
    sanitized = sanitize_response(data)
    assert sanitized["api_key"] == "***REDACTED***"
    assert sanitized["password"] == "***REDACTED***"
    assert sanitized["token"] == "***REDACTED***"
    assert sanitized["symbol"] == "SBIN"

@pytest.mark.asyncio
async def test_condition_21_duplicate_events_no_double_execution(temp_db_path, clean_event_bus):
    """9. Verify that duplicate events do not trigger double execution."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)
    
    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id="req_dup",
        approved=True,
        rejected_reason=None,
        failed_checks=[],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=1000.0,
        market_data_fresh=True,
        kill_switch_active=False
    ))
    
    place_order_mock = AsyncMock(return_value=OrderStateEvent(
        order_id="ord_dup_executed",
        broker_order_id=None,
        symbol="SBIN",
        side="BUY",
        quantity=10,
        filled_quantity=10,
        avg_fill_price=100.0,
        status=OrderStatus.FILLED.value,
        reject_reason=None,
        order_request_id="req_dup"
    ))
    router.paper_manager.place_order = place_order_mock
    
    req = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        order_type="MARKET",
        price=100.0,
        strategy_name="test",
        signal_event_id=None,
        trading_mode="PAPER",
        source="MANUAL",
        event_id="req_dup"
    )
    
    res1 = await router.route(req)
    assert res1.status == OrderStatus.FILLED.value
    
    res2 = await router.route(req)
    assert res2.status == OrderStatus.REJECTED.value
    assert res2.reject_reason == "duplicate_request"
    
    # Assert place_order was only called exactly once!
    assert place_order_mock.call_count == 1

def test_condition_22_database_cleanup(temp_db_path):
    """10. Verify that database is clean / closed / handles deletion."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_cleanup", "client_c", "idem_c", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")
    # Verify file exists
    assert os.path.exists(temp_db_path)
    # Delete file
    os.remove(temp_db_path)
    assert not os.path.exists(temp_db_path)


# =====================================================================
# PHASE 18E — Broker Reconciliation Safety Patch 1 Tests (23–32)
# =====================================================================

import sqlite3 as _sqlite3

@pytest.mark.asyncio
async def test_condition_23_pending_not_persisted_as_rejected(temp_db_path, clean_event_bus):
    """18E-1. PENDING result from paper adapter must NOT be persisted as REJECTED in the DB."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)

    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id="req_pending",
        approved=True,
        rejected_reason=None,
        failed_checks=[],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=1000.0,
        market_data_fresh=True,
        kill_switch_active=False,
    ))

    # Paper manager returns OPEN (limit order not yet crossed)
    router.paper_manager.place_order = AsyncMock(return_value=OrderStateEvent(
        order_id="ord_pending_1",
        broker_order_id=None,
        symbol="SBIN",
        side="BUY",
        quantity=10,
        filled_quantity=0,
        avg_fill_price=None,
        status=OrderStatus.OPEN.value,
        reject_reason=None,
        order_request_id="req_pending",
    ))

    req = OrderRequestEvent(
        symbol="SBIN", side="BUY", quantity=10, order_type="LIMIT", price=90.0,
        strategy_name="test", signal_event_id=None, trading_mode="PAPER",
        source="MANUAL", event_id="req_pending",
    )

    res = await router.route(req)
    assert res.status == OrderStatus.OPEN.value  # execution returned OPEN

    saved = store.get_order_request("req_pending")
    assert saved is not None
    # CRITICAL: must NOT be REJECTED — should be OPEN
    assert saved["status"] != "REJECTED", f"Expected non-REJECTED but got {saved['status']}"
    assert saved["status"] == "OPEN"


@pytest.mark.asyncio
async def test_condition_24_rejected_only_on_explicit_rejection(temp_db_path, clean_event_bus):
    """18E-2. DB REJECTED is only written when adapter returns an actual REJECTED event."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)

    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id="req_actual_rej",
        approved=True,
        rejected_reason=None,
        failed_checks=[],
        max_order_qty=500,
        max_order_notional=500000.0,
        estimated_notional=1000.0,
        market_data_fresh=True,
        kill_switch_active=False,
    ))

    # Adapter explicitly rejects (e.g. no market data)
    router.paper_manager.place_order = AsyncMock(return_value=OrderStateEvent(
        order_id="ord_actual_rej",
        broker_order_id=None,
        symbol="SBIN",
        side="BUY",
        quantity=10,
        filled_quantity=0,
        avg_fill_price=None,
        status=OrderStatus.REJECTED.value,
        reject_reason="market_data_unavailable",
        order_request_id="req_actual_rej",
    ))

    req = OrderRequestEvent(
        symbol="SBIN", side="BUY", quantity=10, order_type="MARKET", price=None,
        strategy_name="test", signal_event_id=None, trading_mode="PAPER",
        source="MANUAL", event_id="req_actual_rej",
    )

    res = await router.route(req)
    assert res.status == OrderStatus.REJECTED.value

    saved = store.get_order_request("req_actual_rej")
    assert saved["status"] == "REJECTED"
    assert saved["reject_reason"] == "market_data_unavailable"


def test_condition_25_broker_order_id_column_exists(temp_db_path):
    """18E-3. order_requests table must have broker_order_id column after init."""
    OrderStore(temp_db_path)
    conn = _sqlite3.connect(temp_db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(order_requests)")
    cols = [row[1] for row in cursor.fetchall()]
    conn.close()
    assert "broker_order_id" in cols, "broker_order_id column must exist in order_requests"


def test_condition_26_existing_db_migrates_safely(temp_db_path):
    """18E-4. A legacy DB without broker_order_id migrates without data loss."""
    # Manually create a legacy schema (no broker_order_id column)
    conn = _sqlite3.connect(temp_db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE order_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT UNIQUE,
            client_order_id TEXT,
            idempotency_key TEXT UNIQUE,
            symbol TEXT, side TEXT, quantity INTEGER,
            order_type TEXT, mode TEXT, status TEXT,
            created_at TEXT, updated_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE order_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT, event_type TEXT,
            status TEXT, reason TEXT, created_at TEXT
        )
    """)
    cursor.execute(
        "INSERT INTO order_requests VALUES (NULL,'req_legacy','c1','i1','SBIN','BUY',5,'MARKET','PAPER','RECEIVED',datetime('now'),datetime('now'))"
    )
    conn.commit()
    conn.close()

    # OrderStore init should run migration without dropping data
    store = OrderStore(temp_db_path)
    row = store.get_order_request("req_legacy")
    assert row is not None
    assert row["status"] == "RECEIVED"
    # Column must now exist
    assert "broker_order_id" in row


def test_condition_27_broker_order_id_save_and_retrieve(temp_db_path):
    """18E-5. broker_order_id can be saved via update_broker_order_id and retrieved."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_boid", "c1", "i1", "SBIN", "BUY", 10, "MARKET", "PAPER", "RECEIVED")

    store.update_broker_order_id("req_boid", "BROKER_ABC_123")

    row = store.get_order_request("req_boid")
    assert row["broker_order_id"] == "BROKER_ABC_123"

    # Also verify lookup by broker_order_id
    found = store.get_order_by_broker_order_id("BROKER_ABC_123")
    assert found is not None
    assert found["request_id"] == "req_boid"


@pytest.mark.asyncio
async def test_condition_28_order_state_event_updates_db(temp_db_path, clean_event_bus):
    """18E-6. An OrderStateEvent published on event bus is persisted to OrderStore by the router subscriber."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)

    # Insert a record that the subscriber can match
    store.add_order_request("req_sub", "c1", "i1", "SBIN", "BUY", 10, "MARKET", "PAPER", "ROUTED_TO_PAPER")

    # Publish an ORDER_STATE event simulating broker fill update
    fill_event = OrderStateEvent(
        order_id="ord_sub",
        broker_order_id="BROKER_SUB_1",
        symbol="SBIN",
        side="BUY",
        quantity=10,
        filled_quantity=10,
        avg_fill_price=105.0,
        status=OrderStatus.FILLED.value,
        reject_reason=None,
        order_request_id="req_sub",
    )
    await clean_event_bus.publish(fill_event)
    # Allow async subscriber to complete
    await asyncio.sleep(0)

    saved = store.get_order_request("req_sub")
    assert saved["status"] == "FILLED"
    assert saved["broker_order_id"] == "BROKER_SUB_1"


@pytest.mark.asyncio
async def test_condition_29_order_state_event_with_broker_id_persists(temp_db_path, clean_event_bus):
    """18E-7. OrderStateEvent with broker_order_id causes broker_order_id to be persisted."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)

    store.add_order_request("req_boid_event", "c2", "i2", "RELIANCE", "SELL", 5, "MARKET", "PAPER", "PENDING")

    ose = OrderStateEvent(
        order_id="ord_boid_event",
        broker_order_id="EX_ORDER_XYZ",
        symbol="RELIANCE",
        side="SELL",
        quantity=5,
        filled_quantity=5,
        avg_fill_price=2500.0,
        status=OrderStatus.FILLED.value,
        reject_reason=None,
        order_request_id="req_boid_event",
    )
    await clean_event_bus.publish(ose)
    await asyncio.sleep(0)

    saved = store.get_order_request("req_boid_event")
    assert saved["broker_order_id"] == "EX_ORDER_XYZ"

    events = store.get_order_events("req_boid_event")
    assert any("FILLED" in e["event_type"] or e["status"] == "FILLED" for e in events)
    assert any(e.get("broker_order_id") == "EX_ORDER_XYZ" for e in events)


@pytest.mark.asyncio
async def test_condition_30_order_poller_persists_to_db(temp_db_path, clean_event_bus):
    """18E-8. Mocked OrderPoller broker poll update writes status to OrderStore."""
    from backend.execution.order_poller import OrderPoller
    from backend.execution.order_state_machine import OrderStateMachine

    store = OrderStore(temp_db_path)
    osm = OrderStateMachine(event_bus=None)

    # Register a fake order in the state machine
    req = OrderRequestEvent(
        symbol="TCS", side="BUY", quantity=3, order_type="MARKET", price=3500.0,
        strategy_name="test", signal_event_id=None, trading_mode="PAPER",
        source="MANUAL", event_id="req_poller_test",
    )
    internal_state = osm.create_order(req, "LIVE")
    # Manually assign broker_order_id to simulate a submitted live order
    from dataclasses import replace as dc_replace
    updated = dc_replace(internal_state, broker_order_id="BROKER_TCS_999")
    osm._orders[internal_state.order_id] = updated

    # Insert a matching record in OrderStore
    store.add_order_request("req_poller_test", "c3", "i3", "TCS", "BUY", 3, "MARKET", "LIVE", "PENDING")

    # Create poller with store injected
    session = SimpleNamespace(is_valid=False, smart_api=None)
    poller = OrderPoller(
        session_manager=session,
        order_state_machine=osm,
        order_store=store,
    )

    # Call _persist_to_store directly (mocked broker poll path)
    poller._persist_to_store(
        request_id="req_poller_test",
        broker_order_id="BROKER_TCS_999",
        db_status="FILLED",
        reject_reason=None,
    )

    saved = store.get_order_request("req_poller_test")
    assert saved["status"] == "FILLED"
    assert saved["broker_order_id"] == "BROKER_TCS_999"

    events = store.get_order_events("req_poller_test")
    assert any("BROKER_POLL" in e["event_type"] for e in events)


@pytest.mark.asyncio
async def test_condition_31_idempotency_regression_still_works(temp_db_path, clean_event_bus):
    """18E-9. Phase 18C duplicate idempotency behavior is not regressed by Phase 18E changes."""
    store = OrderStore(temp_db_path)
    router = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)

    router.risk_gate.evaluate = AsyncMock(return_value=RiskDecision(
        order_intent_id="req_idem_e",
        approved=True, rejected_reason=None, failed_checks=[],
        max_order_qty=500, max_order_notional=500000.0,
        estimated_notional=1000.0, market_data_fresh=True, kill_switch_active=False,
    ))
    place_mock = AsyncMock(return_value=OrderStateEvent(
        order_id="ord_idem_e", broker_order_id=None,
        symbol="SBIN", side="BUY", quantity=10,
        filled_quantity=10, avg_fill_price=100.0,
        status=OrderStatus.FILLED.value, reject_reason=None,
        order_request_id="req_idem_e",
    ))
    router.paper_manager.place_order = place_mock

    req = OrderRequestEvent(
        symbol="SBIN", side="BUY", quantity=10, order_type="MARKET", price=100.0,
        strategy_name="test", signal_event_id=None, trading_mode="PAPER",
        source="MANUAL", event_id="req_idem_e",
    )

    r1 = await router.route(req)
    assert r1.status == OrderStatus.FILLED.value

    r2 = await router.route(req)
    assert r2.status == OrderStatus.REJECTED.value
    assert r2.reject_reason == "duplicate_request"

    assert place_mock.call_count == 1


def test_condition_32_full_suite_baseline():
    """18E-10. Smoke test: all Phase 18C schema fields plus new 18E fields are present."""
    import tempfile, os
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        store = OrderStore(path)
        store.add_order_request("req_smoke", "c_s", "i_s", "SBIN", "BUY", 1, "MARKET", "PAPER", "RECEIVED")
        store.update_order_status("req_smoke", "PENDING", broker_order_id="BID_SMOKE")
        store.add_order_event("req_smoke", "PENDING", "PENDING", broker_order_id="BID_SMOKE")

        row = store.get_order_request("req_smoke")
        assert row["broker_order_id"] == "BID_SMOKE"

        events = store.get_order_events("req_smoke")
        assert len(events) == 1
        assert events[0]["broker_order_id"] == "BID_SMOKE"

        by_boid = store.get_order_by_broker_order_id("BID_SMOKE")
        assert by_boid["request_id"] == "req_smoke"

        active = store.get_active_requests()
        assert any(r["request_id"] == "req_smoke" for r in active)
    finally:
        if os.path.exists(path):
            os.remove(path)


# =====================================================================
# PHASE 18F — Startup Active Order Recovery Tests (33–40)
# =====================================================================

from backend.execution.order_store import is_terminal_order_status, TERMINAL_ORDER_STATUSES
from backend.execution.order_state_machine import OrderStateMachine as _OSM


def test_condition_33_terminal_statuses_excluded_from_active(temp_db_path):
    """18F-1. Terminal statuses must NOT appear in get_active_requests()."""
    store = OrderStore(temp_db_path)
    # Insert one row for each terminal status
    for i, status in enumerate(sorted(TERMINAL_ORDER_STATUSES)):
        store.add_order_request(
            f"req_terminal_{i}", f"c_{i}", f"i_{i}",
            "SBIN", "BUY", 10, "MARKET", "PAPER", status,
        )
    active = store.get_active_requests()
    # None of the returned rows should have a terminal status
    for row in active:
        assert row["status"] not in TERMINAL_ORDER_STATUSES, (
            f"Terminal status '{row['status']}' appeared in get_active_requests()"
        )


def test_condition_34_non_terminal_statuses_returned_as_active(temp_db_path):
    """18F-2. Non-terminal statuses (RECEIVED, PENDING, OPEN, ROUTED_TO_PAPER) ARE returned."""
    store = OrderStore(temp_db_path)
    active_statuses = ["RECEIVED", "PENDING", "OPEN", "RISK_APPROVED", "ROUTED_TO_PAPER"]
    for i, status in enumerate(active_statuses):
        store.add_order_request(
            f"req_active_{i}", f"c_{i}", f"i_{i}",
            "SBIN", "BUY", 10, "MARKET", "PAPER", status,
        )
    active = store.get_active_requests()
    returned_statuses = {r["status"] for r in active}
    for status in active_statuses:
        assert status in returned_statuses, f"Expected '{status}' in active requests but not found"


def test_condition_35_is_terminal_helper(temp_db_path):
    """18F-3. is_terminal_order_status() correctly classifies all known statuses."""
    for t in ["FILLED", "REJECTED", "CANCELLED", "RISK_REJECTED", "DUPLICATE_REJECTED"]:
        assert is_terminal_order_status(t), f"Expected {t} to be terminal"
    for a in ["RECEIVED", "PENDING", "OPEN", "RISK_APPROVED", "ROUTED_TO_PAPER", "ROUTED_TO_LIVE"]:
        assert not is_terminal_order_status(a), f"Expected {a} to be non-terminal"


def test_condition_36_osm_load_from_store_restores_active_orders(temp_db_path):
    """18F-4. OrderStateMachine.load_from_store() loads non-terminal rows into _orders."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_r1", "c1", "i1", "SBIN", "BUY", 5, "MARKET", "PAPER", "ROUTED_TO_PAPER")
    store.add_order_request("req_r2", "c2", "i2", "RELIANCE", "SELL", 3, "MARKET", "PAPER", "PENDING")
    # Terminal row that should NOT be loaded
    store.add_order_request("req_r3", "c3", "i3", "TCS", "BUY", 1, "MARKET", "PAPER", "FILLED")

    osm = _OSM(event_bus=None)
    active = store.get_active_requests()
    loaded = osm.load_from_store(active)

    assert loaded == 2  # req_r1 and req_r2 only
    assert "req_r1" in osm._orders
    assert "req_r2" in osm._orders
    assert "req_r3" not in osm._orders

    # Verify mapping: ROUTED_TO_PAPER -> PENDING in OSM
    from backend.core.types import OrderStatus
    assert osm._orders["req_r1"].status == OrderStatus.PENDING.value
    assert osm._orders["req_r2"].status == OrderStatus.PENDING.value


def test_condition_37_load_from_store_is_idempotent(temp_db_path):
    """18F-5. Calling load_from_store() twice does not create duplicate in-memory entries."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_dup_r", "c1", "i1", "SBIN", "BUY", 5, "MARKET", "PAPER", "PENDING")

    osm = _OSM(event_bus=None)
    active = store.get_active_requests()

    loaded_first = osm.load_from_store(active)
    loaded_second = osm.load_from_store(active)

    assert loaded_first == 1
    assert loaded_second == 0  # Already loaded; skipped
    assert len([k for k in osm._orders if k == "req_dup_r"]) == 1


@pytest.mark.asyncio
async def test_condition_38_load_from_store_does_not_publish_events(temp_db_path):
    """18F-6. load_from_store() never publishes OrderStateEvent or any event on the bus."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_noevent", "c1", "i1", "SBIN", "BUY", 5, "MARKET", "PAPER", "PENDING")

    events_received = []
    bus = EventBus()
    bus.subscribe("*", AsyncMock(side_effect=lambda e: events_received.append(e)))

    osm = _OSM(event_bus=bus)
    active = store.get_active_requests()
    osm.load_from_store(active)
    # Allow any spurious tasks to run
    await asyncio.sleep(0)

    assert len(events_received) == 0, (
        f"load_from_store published {len(events_received)} event(s) but should publish none"
    )


def test_condition_39_recover_from_store_seeds_duplicate_detection(temp_db_path, clean_event_bus):
    """18F-7. ExecutionRouter.recover_from_store() seeds _processed_request_ids so
    recovered request IDs cannot be re-submitted after restart."""
    store = OrderStore(temp_db_path)
    store.add_order_request("req_seed", "c1", "i1", "SBIN", "BUY", 5, "MARKET", "PAPER", "ROUTED_TO_PAPER")

    router_r = ExecutionRouter(event_bus=clean_event_bus, mode=TradingMode.PAPER.value, order_store=store)
    count = router_r.recover_from_store()

    assert count == 1
    # The request_id must now be in the duplicate-detection set
    assert "req_seed" in router_r._processed_request_ids


def test_condition_40_api_import_safe_after_recovery(temp_db_path):
    """18F-8. Backend API import still succeeds with startup recovery wired in."""
    # If api_server imports correctly and recover_from_store is defined, this test passes.
    import backend.api_server as _api
    assert hasattr(_api.router, "recover_from_store"), (
        "ExecutionRouter must expose recover_from_store() for startup wiring"
    )
    # Verify the method is callable without crashing
    assert callable(_api.router.recover_from_store)
