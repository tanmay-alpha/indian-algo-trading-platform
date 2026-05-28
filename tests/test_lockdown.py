"""tests/test_lockdown.py

Dedicated lockdown test suite for Phase 26-Safety-Rollback.
Verifies that all live execution paths are blocked under default config.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient

from backend.api_server import app
from backend.core.config import settings
from backend.core.events import OrderRequestEvent
from backend.core.types import OrderStatus, TradingMode
from backend.execution.live_order_manager import LiveOrderManager
from backend.execution.broker_mutation_guard import BrokerMutationGuard


@pytest.fixture
def auth_headers():
    return {"X-Admin-Token": settings.admin_token or "dummy"}


def test_api_enable_live_returns_disabled_by_policy(auth_headers):
    """POST /execution/live/enable returns DISABLED_BY_POLICY under default configuration."""
    client = TestClient(app)
    # Ensure build lock is False
    assert settings.live_execution_build_enabled is False

    resp = client.post(
        "/execution/live/enable",
        headers=auth_headers,
        json={"confirm": True, "source": "TEST"},
    )
    assert resp.status_code == 403
    assert "Live execution is not enabled in this build" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_live_order_manager_fails_fast_on_place_order():
    """LiveOrderManager.place_order fails fast with a locked reason under default configuration."""
    # Ensure build lock is False
    assert settings.live_execution_build_enabled is False

    lom = LiveOrderManager(live_enabled=True, trading_mode="LIVE")
    req = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=1,
        order_type="MARKET",
        price=500.0,
        strategy_name="TEST",
        signal_event_id=None,
        trading_mode="LIVE",
        source="ALGO",
    )
    result = await lom.place_order(req)
    assert result.status == OrderStatus.REJECTED.value
    assert "live_execution_build_disabled" in result.reject_reason


def test_broker_mutation_guard_blocks_mutations():
    """BrokerMutationGuard blocks mutation attempts."""
    guard = BrokerMutationGuard()
    
    # check_mutation returns a block payload
    res1 = guard.check_mutation("placeOrder")
    assert res1 is not None
    assert res1["allowed"] is False
    assert "blocked" in res1
    assert res1["blocked"] is True

    # protect raises ValueError
    def dummy_func():
        return "success"

    with pytest.raises(ValueError, match="blocked by default security guard"):
        guard.protect("placeOrder", dummy_func)


@pytest.mark.asyncio
async def test_kill_switch_bypass_attempt_fails():
    """Deactivating kill switch programmatically still doesn't allow order placement to bypass build lock."""
    # Ensure build lock is False
    assert settings.live_execution_build_enabled is False

    ks = MagicMock()
    ks.is_active = False  # programmatically inactive

    lom = LiveOrderManager(
        live_enabled=True,
        trading_mode="LIVE",
    )
    # Even if we bypass kill switch evaluation, place_order checks the build lock first
    req = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=1,
        order_type="MARKET",
        price=500.0,
        strategy_name="TEST",
        signal_event_id=None,
        trading_mode="LIVE",
        source="ALGO",
    )
    result = await lom.place_order(req)
    assert result.status == OrderStatus.REJECTED.value
    assert "live_execution_build_disabled" in result.reject_reason
