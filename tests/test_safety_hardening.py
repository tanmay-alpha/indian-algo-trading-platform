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
