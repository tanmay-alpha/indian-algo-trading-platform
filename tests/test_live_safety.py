import pytest
import asyncio
from unittest.mock import Mock, AsyncMock
from fastapi.testclient import TestClient

from backend.core.event_bus import EventBus
from backend.core.events import EventType, OrderRequestEvent
from backend.execution.kill_switch import KillSwitchService
from backend.execution.broker_mutation_guard import BrokerMutationGuard
from backend.execution.broker_rate_limiter import BrokerRateLimiter
from backend.execution.broker_error_classifier import BrokerErrorClassifier
from backend.execution.manual_order_policy import ManualOrderPolicy
import backend.api_server as api

client = TestClient(api.app)

@pytest.fixture
def clean_event_bus():
    return EventBus()


# 1. KillSwitchService Tests
@pytest.mark.asyncio
async def test_kill_switch_service_activation(clean_event_bus):
    ks = KillSwitchService(event_bus=clean_event_bus, default_active=False)
    events = []
    
    async def listener(event):
        events.append(event)
        
    clean_event_bus.subscribe(EventType.ERROR.value, listener)
    
    assert ks.is_active is False
    
    ks.activate(reason="Test Activation", source="SYSTEM")
    assert ks.is_active is True
    assert ks.status()["reason"] == "Test Activation"
    
    # Wait for events to propagate
    await asyncio.sleep(0.01)
    assert len(events) == 1
    assert events[0].error_type == "KILL_SWITCH_ACTIVATED"


@pytest.mark.asyncio
async def test_kill_switch_service_deactivation(clean_event_bus):
    ks = KillSwitchService(event_bus=clean_event_bus, default_active=True)
    events = []
    
    async def listener(event):
        events.append(event)
        
    clean_event_bus.subscribe(EventType.ERROR.value, listener)
    
    assert ks.is_active is True
    
    # Needs confirmation to deactivate
    assert ks.deactivate(confirm=False) is False
    assert ks.is_active is True
    
    assert ks.deactivate(confirm=True, source="ADMIN") is True
    assert ks.is_active is False
    
    await asyncio.sleep(0.01)
    assert len(events) == 1
    assert events[0].error_type == "KILL_SWITCH_DEACTIVATED"


# 2. BrokerMutationGuard Tests
def test_broker_mutation_guard():
    guard = BrokerMutationGuard(enabled=True)
    
    # Allow read operations
    assert guard.protect("get_profile", lambda: "profile") == "profile"
    assert guard.protect("fetch_positions", lambda: []) == []
    
    # Block mutations
    with pytest.raises(ValueError) as exc:
        guard.protect("placeOrder", lambda: "order_id")
    assert "placeOrder is blocked" in str(exc.value)
    
    with pytest.raises(ValueError) as exc:
        guard.protect("cancelOrder", lambda: "success")
    assert "cancelOrder is blocked" in str(exc.value)


# 3. BrokerRateLimiter Tests
@pytest.mark.asyncio
async def test_broker_rate_limiter():
    limiter = BrokerRateLimiter(max_rate_per_sec=3.0, max_rate_per_min=10.0)
    
    # Allow up to burst
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    
    # Next request must raise RateLimitExceeded
    from backend.execution.broker_rate_limiter import RateLimitExceeded
    with pytest.raises(RateLimitExceeded):
        await limiter.acquire()


# 4. BrokerErrorClassifier Tests
def test_broker_error_classifier():
    classifier = BrokerErrorClassifier()
    
    # Token / Session expired errors
    assert classifier.classify("Invalid session token or key expired") == "AUTH_FAILED"
    assert classifier.classify("token expired") == "AUTH_FAILED"
    
    # Margin errors
    assert classifier.classify("insufficient margin available") == "INSUFFICIENT_FUNDS"
    
    # Network errors
    assert classifier.classify("Connection to broker timed out") == "NETWORK_TIMEOUT"
    
    # Rate limit errors
    assert classifier.classify("Rate limit exceeded") == "RATE_LIMIT"
    
    # Validation errors
    assert classifier.classify("validation error") == "UNKNOWN"  # because validation is not in list of patterns, matches UNKNOWN or REJECTED_BY_BROKER
    assert classifier.classify("invalid order type") == "REJECTED_BY_BROKER"


# 5. ManualOrderPolicy Tests
def test_manual_order_policy():
    policy = ManualOrderPolicy()
    
    # Valid order
    order_req = OrderRequestEvent(
        symbol="SBIN-EQ",
        side="BUY",
        quantity=1,
        order_type="LIMIT",
        price=100.0,
        strategy_name="MANUAL",
        trading_mode="LIVE",
        source="MANUAL",
        signal_event_id=None
    )
    order_req.product_type = "CNC"
    order_req.instrument_type = "EQUITY"
    
    is_valid, reason = policy.validate(order_req)
    assert is_valid is True
    
    # Invalid quantity
    order_req.quantity = 2
    is_valid, reason = policy.validate(order_req)
    assert is_valid is False
    assert "Quantity exceeds maximum allowed" in reason
    
    # Invalid product type
    order_req.quantity = 1
    order_req.product_type = "MIS"
    is_valid, reason = policy.validate(order_req)
    assert is_valid is False
    assert "Product type MIS not allowed" in reason
    
    # Market order check
    order_req.product_type = "CNC"
    order_req.order_type = "MARKET"
    is_valid, reason = policy.validate(order_req)
    assert is_valid is False
    assert "Market orders are restricted" in reason


# 6. Safety Router Endpoint Tests
def test_safety_router_endpoints():
    # Fetch admin token
    from backend.core.config import settings
    admin_token = settings.admin_token
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get Status
    res = client.get("/safety/live/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "kill_switch" in data
    assert "broker_mutation_guard" in data
    assert "manual_order_policy" in data
    
    # Activate Kill Switch
    res = client.post("/safety/kill-switch/activate", json={"reason": "Testing endpoints", "updated_by": "TEST_RUNNER"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["kill_switch"]["active"] is True
    
    # Deactivate Kill Switch
    res = client.post("/safety/kill-switch/deactivate", json={"updated_by": "TEST_RUNNER"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["kill_switch"]["active"] is False
