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
from backend.execution.manual_order_policy import ManualOrderPolicy, ManualOrderLivePolicy
import backend.api_server as api

client = TestClient(api.app)

@pytest.fixture
def clean_event_bus():
    return EventBus()

# 1. kill switch default true in production
def test_kill_switch_default_true():
    ks = KillSwitchService(event_bus=None) # no default_active passed
    assert ks.is_active is True
    assert ks.blocking_live_orders is True

# 2. kill switch status schema fields
def test_kill_switch_status_schema_fields():
    ks = KillSwitchService(event_bus=None, default_active=True)
    status = ks.status()
    assert "active" in status
    assert "blocking_live_orders" in status
    assert "reason" in status
    assert "updated_at" in status
    assert "updated_by" in status
    assert "audit" in status

# 3. activate updates status reasons and audit
def test_kill_switch_activate_updates_status():
    ks = KillSwitchService(event_bus=None, default_active=False)
    ks.activate(reason="High latency detected", source="ADMIN_USER")
    status = ks.status()
    assert ks.is_active is True
    assert ks.blocking_live_orders is True
    assert status["reason"] == "High latency detected"
    assert status["updated_by"] == "ADMIN_USER"
    assert len(status["audit"]) == 1
    assert status["audit"][0]["action"] == "ACTIVATE"
    assert status["audit"][0]["reason"] == "High latency detected"

# 4. deactivate requires confirmation and clears status
def test_kill_switch_deactivate_behavior():
    ks = KillSwitchService(event_bus=None, default_active=True)
    # Deactivate without confirmation should fail
    res = ks.deactivate(confirm=False, source="ADMIN_USER")
    assert res is False
    assert ks.is_active is True
    
    # Deactivate with confirmation should succeed
    res = ks.deactivate(confirm=True, source="ADMIN_USER")
    assert res is True
    assert ks.is_active is False
    assert ks.blocking_live_orders is False
    assert ks.reason is None

# 5. deactivating kill switch does not permit live trading
def test_deactivating_kill_switch_does_not_permit_live():
    ks = KillSwitchService(event_bus=None, default_active=True)
    ks.deactivate(confirm=True)
    assert ks.is_active is False
    
    policy = ManualOrderLivePolicy()
    assert policy.allow_live_orders is False

# 6. mutation guard blocks place
def test_mutation_guard_blocks_place():
    guard = BrokerMutationGuard(enabled=True)
    rejection = guard.check_mutation("place")
    assert rejection is not None
    assert rejection["allowed"] is False
    with pytest.raises(ValueError):
        guard.protect("place", lambda: "success")

# 7. mutation guard blocks cancel
def test_mutation_guard_blocks_cancel():
    guard = BrokerMutationGuard(enabled=True)
    rejection = guard.check_mutation("cancel")
    assert rejection is not None
    assert rejection["allowed"] is False
    with pytest.raises(ValueError):
        guard.protect("cancel", lambda: "success")

# 8. mutation guard blocks modify
def test_mutation_guard_blocks_modify():
    guard = BrokerMutationGuard(enabled=True)
    rejection = guard.check_mutation("modify")
    assert rejection is not None
    assert rejection["allowed"] is False
    with pytest.raises(ValueError):
        guard.protect("modify", lambda: "success")

# 9. mutation guard blocks squareoff
def test_mutation_guard_blocks_squareoff():
    guard = BrokerMutationGuard(enabled=True)
    rejection = guard.check_mutation("squareoff")
    assert rejection is not None
    assert rejection["allowed"] is False
    with pytest.raises(ValueError):
        guard.protect("squareoff", lambda: "success")

# 10. mutation guard returns structured rejection schema
def test_mutation_guard_structured_rejection_schema():
    guard = BrokerMutationGuard(enabled=True)
    rejection = guard.check_mutation("place")
    assert rejection["allowed"] is False
    assert "reason" in rejection
    assert rejection["guard_name"] == "BrokerMutationGuard"
    assert rejection["live_execution_enabled"] is False

# 11. rate limiter allows within limit
@pytest.mark.asyncio
async def test_rate_limiter_allows_within_limit():
    limiter = BrokerRateLimiter(max_rate_per_sec=2.0, max_rate_per_min=5.0)
    await limiter.acquire()
    await limiter.acquire()
    from backend.execution.broker_rate_limiter import RateLimitExceeded
    with pytest.raises(RateLimitExceeded):
        await limiter.acquire()

# 12. manual live policy defaults to allow_live_orders=false
def test_manual_live_policy_defaults():
    policy = ManualOrderLivePolicy()
    assert policy.allow_live_orders is False
    assert policy.max_quantity == 1
    assert policy.cnc_only is True
    assert policy.market_only is True
    assert policy.equity_only is True
    assert policy.requires_final_confirmation is True
    assert policy.requires_kill_switch_clear is True
    assert policy.requires_broker_reconciliation_ok is True

# 13. deactivated kill switch still does not enable live trading
def test_deactivated_kill_switch_still_blocks_live_trading():
    ks = KillSwitchService(event_bus=None, default_active=True)
    ks.deactivate(confirm=True)
    assert ks.is_active is False
    
    policy = ManualOrderLivePolicy()
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
    is_valid, reason = policy.validate(order_req)
    assert is_valid is False
    assert "locked by policy" in reason

# 14. admin token authorization requirement
def test_admin_token_authorization_requirement():
    from backend.core.config import settings
    original_token = settings.admin_token
    settings.admin_token = "test_admin_token"
    try:
        # Without token
        res = client.get("/safety/live/status")
        assert res.status_code in (401, 403)
        
        res = client.get("/safety/kill-switch/status")
        assert res.status_code in (401, 403)
        
        # With invalid token
        headers = {"Authorization": "Bearer INVALID_TOKEN"}
        res = client.get("/safety/live/status", headers=headers)
        assert res.status_code in (401, 403)
        
        # With valid legacy admin token
        headers = {"X-Admin-Token": "test_admin_token"}
        res = client.get("/safety/live/status", headers=headers)
        assert res.status_code == 200
        
        res = client.get("/safety/kill-switch/status", headers=headers)
        assert res.status_code == 200
    finally:
        settings.admin_token = original_token

# 15. credentials redacting in error classifier
def test_credentials_redacting_in_error_classifier():
    classifier = BrokerErrorClassifier()
    # Test redacting API keys / passwords / tokens
    raw_error_1 = Exception("Authentication failed for api_key=12345-abc-xyz")
    safe_msg_1 = classifier.get_safe_message(raw_error_1)
    assert "12345-abc-xyz" not in safe_msg_1
    assert "api_key=[REDACTED]" in safe_msg_1 or "api_key" not in safe_msg_1 or "[REDACTED]" in safe_msg_1
    
    raw_error_2 = Exception("Connection URI: postgres://admin:secretPass@localhost:5432/db")
    safe_msg_2 = classifier.get_safe_message(raw_error_2)
    assert "secretPass" not in safe_msg_2
    assert "postgres" not in safe_msg_2 or "[REDACTED" in safe_msg_2

# 16. LIVE mode does not bypass mutation guard
def test_live_mode_does_not_bypass_mutation_guard():
    # Even if enabled is True and we try to place an order, it should block
    guard = BrokerMutationGuard(enabled=True)
    rejection = guard.check_mutation("place", {"mode": "LIVE"})
    assert rejection is not None
    assert rejection["allowed"] is False
    assert rejection["live_execution_enabled"] is False

# Extra validation to ensure normal manual order policy checks still function as before
def test_manual_order_policy_basic():
    policy = ManualOrderPolicy()
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
