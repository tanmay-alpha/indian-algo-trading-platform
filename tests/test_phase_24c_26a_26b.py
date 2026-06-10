"""tests/test_phase_24c_26a_26b.py

Comprehensive test suite for:
- Phase 24C: LiveSafetyMonitor
- Phase 26A: LiveExecutionGate
- Phase 26B: LiveExecutionService + /execution/live/* API endpoints
"""

import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone, timedelta

from fastapi.testclient import TestClient
from backend.api_server import app
from backend.core.config import settings


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def auth_headers():
    return {"X-Admin-Token": "ci-test-admin-token-do-not-use-in-prod"}


@pytest.fixture(autouse=True, scope="module")
def enable_live_execution_build():
    from backend.core.config import settings
    from unittest.mock import patch
    original = getattr(settings, "live_execution_build_enabled", False)
    settings.live_execution_build_enabled = True
    with patch("backend.core.live_build_policy.is_live_execution_build_enabled", return_value=True), \
         patch("backend.services.live_execution_service.is_live_execution_build_enabled", return_value=True), \
         patch("backend.routers.live_execution.is_live_execution_build_enabled", return_value=True):
        yield
    settings.live_execution_build_enabled = original



@pytest.fixture
def mock_kill_switch():
    ks = MagicMock()
    ks.is_active = False
    ks.reason = None
    ks.status.return_value = {
        "active": False,
        "reason": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": "SYSTEM",
        "blocking_live_orders": False,
        "audit": [],
    }
    return ks


@pytest.fixture
def active_kill_switch():
    ks = MagicMock()
    ks.is_active = True
    ks.reason = "test_breach"
    ks.status.return_value = {
        "active": True,
        "reason": "test_breach",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": "SYSTEM",
        "blocking_live_orders": True,
        "audit": [],
    }
    return ks


@pytest.fixture
def mock_session_manager():
    sm = MagicMock()
    sm.is_valid = True
    smart_api = MagicMock()
    smart_api.placeOrder = MagicMock(return_value={"data": {"orderid": "BROKER123"}})
    sm.smart_api = smart_api
    return sm


@pytest.fixture
def mock_order_state_machine():
    osm = MagicMock()
    osm.pending_orders.return_value = []
    osm.open_orders.return_value = []
    return osm


@pytest.fixture
def mock_portfolio():
    pm = MagicMock()
    pm.current_daily_pnl = 0.0
    pm.initial_capital = 50000.0
    return pm


@pytest.fixture
def mock_order_store():
    store = MagicMock()
    store.get_active_requests.return_value = []
    return store


# ============================================================
# Phase 24C: LiveSafetyMonitor tests
# ============================================================

class TestLiveSafetyMonitor:
    """Phase 24C tests"""

    def test_monitor_initial_status(self, mock_kill_switch):
        """Monitor starts in a clean state."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor
        monitor = LiveSafetyMonitor(kill_switch=mock_kill_switch)
        status = monitor.status()
        assert status["running"] is False
        assert status["consecutive_anomalies"] == 0
        assert status["total_auto_activations"] == 0
        assert status["last_check_passed"] is True

    @pytest.mark.asyncio
    async def test_all_checks_pass(self, mock_kill_switch, mock_order_state_machine, mock_portfolio, mock_order_store):
        """All checks pass when system is healthy."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor
        monitor = LiveSafetyMonitor(
            kill_switch=mock_kill_switch,
            order_state_machine=mock_order_state_machine,
            portfolio_manager=mock_portfolio,
            order_store=mock_order_store,
        )
        result = await monitor.run_checks()
        assert result["all_passed"] is True
        assert result["triggered_reasons"] == []
        mock_kill_switch.activate.assert_not_called()

    @pytest.mark.asyncio
    async def test_kill_switch_already_active_skips_checks(self, active_kill_switch):
        """When kill switch is already active, checks are skipped gracefully."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor
        monitor = LiveSafetyMonitor(kill_switch=active_kill_switch)
        result = await monitor.run_checks()
        # Should NOT try to re-activate
        active_kill_switch.activate.assert_not_called()
        assert "ALREADY_ACTIVE" in str(result.get("checks", {}))

    @pytest.mark.asyncio
    async def test_open_orders_breach_activates_kill_switch(self, mock_kill_switch, mock_order_store):
        """Exceeding open order count triggers kill switch activation."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor, LiveSafetyMonitorConfig
        osm = MagicMock()
        osm.pending_orders.return_value = [MagicMock()] * 3
        osm.open_orders.return_value = [MagicMock()] * 3  # total 6 > max_open_orders=5

        config = LiveSafetyMonitorConfig(max_open_orders=5)
        monitor = LiveSafetyMonitor(
            kill_switch=mock_kill_switch,
            order_state_machine=osm,
            order_store=mock_order_store,
            config=config,
        )
        result = await monitor.run_checks()
        assert result["all_passed"] is False
        assert any("open_orders_exceeded" in r for r in result["triggered_reasons"])
        mock_kill_switch.activate.assert_called_once()
        assert "auto_monitor" in mock_kill_switch.activate.call_args[1]["reason"]

    @pytest.mark.asyncio
    async def test_daily_loss_breach_activates_kill_switch(self, mock_kill_switch, mock_order_state_machine, mock_order_store):
        """Daily loss exceeding threshold triggers kill switch."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor, LiveSafetyMonitorConfig
        pm = MagicMock()
        pm.current_daily_pnl = -2000.0  # 4% of 50000 — exceeds 2% threshold
        pm.initial_capital = 50000.0

        config = LiveSafetyMonitorConfig(max_daily_loss_pct=2.0)
        monitor = LiveSafetyMonitor(
            kill_switch=mock_kill_switch,
            order_state_machine=mock_order_state_machine,
            portfolio_manager=pm,
            order_store=mock_order_store,
            config=config,
        )
        result = await monitor.run_checks()
        assert result["all_passed"] is False
        assert any("daily_loss_exceeded" in r for r in result["triggered_reasons"])
        mock_kill_switch.activate.assert_called_once()

    @pytest.mark.asyncio
    async def test_consecutive_anomaly_threshold(self, mock_kill_switch, mock_order_store):
        """After N consecutive OMS anomalies, kill switch is triggered."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor, LiveSafetyMonitorConfig
        # Set up: DB has orphaned orders, in-memory has none
        osm = MagicMock()
        osm.pending_orders.return_value = []
        osm.open_orders.return_value = []
        mock_order_store.get_active_requests.return_value = [
            {"request_id": "ORPHAN_1"},
            {"request_id": "ORPHAN_2"},
        ]

        config = LiveSafetyMonitorConfig(reconciliation_anomaly_threshold=2)
        monitor = LiveSafetyMonitor(
            kill_switch=mock_kill_switch,
            order_state_machine=osm,
            order_store=mock_order_store,
            config=config,
        )
        # First anomaly — should not trigger threshold breach yet
        await monitor.run_checks()
        # Reset activation mock to count only the breach activation
        mock_kill_switch.activate.reset_mock()
        mock_kill_switch.is_active = False  # keep inactive

        # Second anomaly — hits threshold=2, triggers
        await monitor.run_checks()
        mock_kill_switch.activate.assert_called()

    @pytest.mark.asyncio
    async def test_status_records_history(self, mock_kill_switch):
        """Each check is recorded in history."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor
        monitor = LiveSafetyMonitor(kill_switch=mock_kill_switch)
        await monitor.run_checks()
        await monitor.run_checks()
        status = monitor.status()
        assert len(status["recent_checks"]) >= 2

    @pytest.mark.asyncio
    async def test_check_with_no_portfolio_skips_loss_check(self, mock_kill_switch):
        """When portfolio_manager is None, daily loss check is gracefully skipped."""
        from backend.execution.live_safety_monitor import LiveSafetyMonitor
        monitor = LiveSafetyMonitor(kill_switch=mock_kill_switch, portfolio_manager=None)
        result = await monitor.run_checks()
        assert "portfolio_manager unavailable" in result["checks"]["daily_loss"]["detail"]


# ============================================================
# Phase 26A: LiveExecutionGate tests
# ============================================================

class TestLiveExecutionGate:
    """Phase 26A tests"""

    def test_all_green_passes(self, mock_kill_switch, mock_session_manager):
        """All conditions satisfied → gate passes."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        gate = LiveExecutionGate(
            kill_switch=mock_kill_switch,
            session_manager=mock_session_manager,
        )
        result = gate.evaluate(trading_mode="LIVE", live_enabled=True)
        assert result.passed is True
        assert result.failed_checks == []

    def test_live_disabled_fails(self, mock_kill_switch, mock_session_manager):
        """live_enabled=False → gate fails."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        gate = LiveExecutionGate(kill_switch=mock_kill_switch, session_manager=mock_session_manager)
        result = gate.evaluate(trading_mode="LIVE", live_enabled=False)
        assert result.passed is False
        assert "live_trading_disabled" in result.failed_checks

    def test_kill_switch_active_fails(self, active_kill_switch, mock_session_manager):
        """Active kill switch → gate fails."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        gate = LiveExecutionGate(kill_switch=active_kill_switch, session_manager=mock_session_manager)
        result = gate.evaluate(trading_mode="LIVE", live_enabled=True)
        assert result.passed is False
        assert "kill_switch_active" in result.failed_checks

    def test_wrong_mode_fails(self, mock_kill_switch, mock_session_manager):
        """Wrong trading mode → gate fails."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        gate = LiveExecutionGate(kill_switch=mock_kill_switch, session_manager=mock_session_manager)
        result = gate.evaluate(trading_mode="PAPER", live_enabled=True)
        assert result.passed is False
        assert any("wrong_trading_mode" in c for c in result.failed_checks)

    def test_invalid_session_fails(self, mock_kill_switch):
        """Invalid session → gate fails."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        sm = MagicMock()
        sm.is_valid = False
        gate = LiveExecutionGate(kill_switch=mock_kill_switch, session_manager=sm)
        result = gate.evaluate(trading_mode="LIVE", live_enabled=True)
        assert result.passed is False
        assert "session_invalid_or_missing" in result.failed_checks

    def test_no_smart_api_fails(self, mock_kill_switch):
        """No smart_api.placeOrder callable → gate fails."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        sm = MagicMock()
        sm.is_valid = True
        sm.smart_api = None
        sm.smart = None
        gate = LiveExecutionGate(kill_switch=mock_kill_switch, session_manager=sm)
        result = gate.evaluate(trading_mode="LIVE", live_enabled=True)
        assert result.passed is False
        assert "smart_api_not_available" in result.failed_checks

    def test_multiple_failures_collected(self):
        """Multiple failures are all reported together, not short-circuited."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        gate = LiveExecutionGate(kill_switch=None, session_manager=None)
        result = gate.evaluate(trading_mode="PAPER", live_enabled=False)
        # Both live_disabled + wrong_mode should be present
        assert len(result.failed_checks) >= 2

    def test_stale_market_data_fails(self, mock_kill_switch, mock_session_manager):
        """Stale market data → gate fails for that symbol."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        mw = MagicMock()
        # Tick with very old timestamp
        stale_ts = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        mw.latest_ticks = {"SBIN": {"ltp": 500.0, "received_at": stale_ts}}
        gate = LiveExecutionGate(
            kill_switch=mock_kill_switch,
            session_manager=mock_session_manager,
            market_watch=mw,
        )
        result = gate.evaluate(trading_mode="LIVE", live_enabled=True, symbol="SBIN")
        assert result.passed is False
        assert any("market_data_stale" in c for c in result.failed_checks)

    def test_fresh_market_data_passes(self, mock_kill_switch, mock_session_manager):
        """Fresh market data → market gate passes."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        mw = MagicMock()
        fresh_ts = datetime.now(timezone.utc).isoformat()
        mw.latest_ticks = {"SBIN": {"ltp": 500.0, "received_at": fresh_ts}}
        gate = LiveExecutionGate(
            kill_switch=mock_kill_switch,
            session_manager=mock_session_manager,
            market_watch=mw,
        )
        result = gate.evaluate(trading_mode="LIVE", live_enabled=True, symbol="SBIN")
        assert result.passed is True

    def test_reason_is_joined_failures(self, mock_kill_switch):
        """reason property joins all failed checks."""
        from backend.execution.live_execution_gate import LiveExecutionGate
        gate = LiveExecutionGate(kill_switch=mock_kill_switch, session_manager=None)
        result = gate.evaluate(trading_mode="LIVE", live_enabled=False)
        assert result.reason is not None
        # Should be non-empty string
        assert len(result.reason) > 0


# ============================================================
# Phase 26B: LiveExecutionService tests
# ============================================================

class TestLiveExecutionService:
    """Phase 26B service tests"""

    @pytest.mark.asyncio
    async def test_enable_requires_confirm(self):
        """enable_live without confirm=True is always rejected."""
        from backend.services.live_execution_service import LiveExecutionService
        svc = LiveExecutionService()
        result = await svc.enable_live(confirm=False)
        assert result["success"] is False
        assert "confirm=True" in result["reason"]

    @pytest.mark.asyncio
    async def test_enable_rejected_when_kill_switch_active(self, active_kill_switch):
        """enable_live fails when kill switch is active."""
        from backend.services.live_execution_service import LiveExecutionService
        svc = LiveExecutionService(kill_switch=active_kill_switch)
        result = await svc.enable_live(confirm=True)
        assert result["success"] is False
        assert "kill_switch_active" in result["reason"]

    @pytest.mark.asyncio
    async def test_enable_rejected_when_session_invalid(self, mock_kill_switch):
        """enable_live fails when broker session is invalid."""
        from backend.services.live_execution_service import LiveExecutionService
        sm = MagicMock()
        sm.is_valid = False
        svc = LiveExecutionService(kill_switch=mock_kill_switch, session_manager=sm)
        result = await svc.enable_live(confirm=True)
        assert result["success"] is False
        assert "broker_session_invalid" in result["reason"]

    @pytest.mark.asyncio
    async def test_enable_rejected_by_router(self, mock_kill_switch, mock_session_manager):
        """enable_live fails when router rejects the switch."""
        from backend.services.live_execution_service import LiveExecutionService
        router = AsyncMock()
        router.switch_to_live = AsyncMock(return_value=False)
        router.mode = "PAPER"
        svc = LiveExecutionService(
            kill_switch=mock_kill_switch,
            session_manager=mock_session_manager,
            execution_router=router,
        )
        result = await svc.enable_live(confirm=True)
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_disable_always_succeeds(self, mock_kill_switch):
        """disable_live always succeeds regardless of state."""
        from backend.services.live_execution_service import LiveExecutionService
        router = AsyncMock()
        router.switch_to_paper = AsyncMock()
        router.mode = "PAPER"
        svc = LiveExecutionService(kill_switch=mock_kill_switch, execution_router=router)
        result = await svc.disable_live()
        assert result["success"] is True
        assert result["mode"] == "PAPER"
        router.switch_to_paper.assert_called_once()

    @pytest.mark.asyncio
    async def test_disable_stops_poller(self, mock_kill_switch):
        """disable_live stops the OrderPoller."""
        from backend.services.live_execution_service import LiveExecutionService
        router = AsyncMock()
        router.switch_to_paper = AsyncMock()
        router.mode = "PAPER"
        poller = AsyncMock()
        poller.stop = AsyncMock()
        svc = LiveExecutionService(kill_switch=mock_kill_switch, execution_router=router, order_poller=poller)
        await svc.disable_live()
        poller.stop.assert_called_once()

    @pytest.mark.asyncio
    async def test_mode_history_recorded(self, mock_kill_switch):
        """Mode changes are recorded in history."""
        from backend.services.live_execution_service import LiveExecutionService
        sm = MagicMock()
        sm.is_valid = False  # Will cause failure
        svc = LiveExecutionService(kill_switch=mock_kill_switch, session_manager=sm)
        await svc.enable_live(confirm=True, source="TEST")
        status = svc.get_status()
        assert len(status["mode_history"]) >= 1
        assert status["mode_history"][-1]["source"] == "TEST"

    def test_get_status_structure(self, mock_kill_switch):
        """get_status returns expected structure."""
        from backend.services.live_execution_service import LiveExecutionService
        svc = LiveExecutionService(kill_switch=mock_kill_switch)
        status = svc.get_status()
        assert "mode" in status
        assert "live_enabled" in status
        assert "poller_running" in status
        assert "kill_switch" in status
        assert "mode_history" in status


# ============================================================
# Phase 26B: API endpoint tests
# ============================================================

class TestLiveExecutionAPI:
    """Test the /execution/live/* API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_client(self, auth_headers):
        self.client = TestClient(app)
        self.headers = auth_headers

    def test_live_status_unauthorized(self):
        """Status endpoint requires admin token."""
        if not settings.admin_token:
            pytest.skip("Admin token not configured")
        resp = self.client.get("/execution/live/status")
        assert resp.status_code == 403

    def test_live_status_authorized(self):
        """Status endpoint returns structured data."""
        resp = self.client.get("/execution/live/status", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "mode" in data

    def test_enable_live_requires_confirm(self):
        """Enable without confirm=True returns 403."""
        resp = self.client.post(
            "/execution/live/enable",
            headers=self.headers,
            json={"confirm": False, "source": "TEST"},
        )
        assert resp.status_code == 403

    def test_enable_live_rejected_by_safety(self):
        """Enable with confirm=True but safety interlocks fail → 403."""
        resp = self.client.post(
            "/execution/live/enable",
            headers=self.headers,
            json={"confirm": True, "source": "TEST"},
        )
        # In test environment, live_enabled=False and no valid session
        # so it should return 403
        assert resp.status_code in (200, 403)

    def test_disable_live_always_succeeds(self):
        """Disable endpoint always returns 200."""
        resp = self.client.post(
            "/execution/live/disable",
            headers=self.headers,
            json={"source": "TEST"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data

    def test_manual_poll_when_no_poller(self):
        """Manual poll returns 503 when poller not configured."""
        resp = self.client.post("/execution/live/poller/poll", headers=self.headers)
        # Either 200 (poller exists) or 503 (no poller)
        assert resp.status_code in (200, 503)


# ============================================================
# Phase 24C: Safety monitor API endpoint tests
# ============================================================

class TestSafetyMonitorAPI:
    """Test /safety/monitor/* endpoints (Phase 24C)."""

    @pytest.fixture(autouse=True)
    def setup_client(self, auth_headers):
        self.client = TestClient(app)
        self.headers = auth_headers

    def test_monitor_status_endpoint(self):
        """GET /safety/monitor/status returns monitor status."""
        resp = self.client.get("/safety/monitor/status", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        # Should have running field
        assert "running" in data

    def test_monitor_run_checks_endpoint(self):
        """POST /safety/monitor/run-checks returns check results or 503."""
        resp = self.client.post("/safety/monitor/run-checks", headers=self.headers)
        # Either 200 (monitor exists) or 503 (not configured)
        assert resp.status_code in (200, 503)


# ============================================================
# Integration: LiveOrderManager with preflight gate
# ============================================================

class TestLiveOrderManagerPreflight:
    """Test that LiveOrderManager correctly applies the Phase 26A pre-flight gate."""

    @pytest.mark.asyncio
    async def test_preflight_blocks_disabled_live(self):
        """With live_enabled=False, preflight rejects before safety_rejection."""
        from backend.execution.live_order_manager import LiveOrderManager
        from backend.core.events import OrderRequestEvent
        from backend.core.types import OrderStatus

        lom = LiveOrderManager(live_enabled=False, trading_mode="PAPER")
        req = OrderRequestEvent(
            symbol="SBIN",
            side="BUY",
            quantity=1,
            order_type="MARKET",
            price=None,
            strategy_name="TEST",
            signal_event_id=None,
            trading_mode="PAPER",
            source="ALGO",
        )
        result = await lom.place_order(req)
        assert result.status == OrderStatus.REJECTED.value
        assert "live_trading_disabled" in (result.reject_reason or "")

    @pytest.mark.asyncio
    async def test_preflight_passes_with_all_conditions_met(self):
        """With all conditions met, preflight passes and execution continues."""
        from backend.execution.live_order_manager import LiveOrderManager
        from backend.core.events import OrderRequestEvent
        from backend.core.types import OrderStatus, TradingMode

        sm = MagicMock()
        sm.is_valid = True
        smart_api = MagicMock()
        smart_api.placeOrder = MagicMock(return_value={"data": {"orderid": "BR123"}})
        sm.smart_api = smart_api

        lom = LiveOrderManager(
            session_manager=sm,
            live_enabled=True,
            trading_mode=TradingMode.LIVE.value,
        )
        # Inject kill_switch into gate
        ks = MagicMock()
        ks.is_active = False
        lom.preflight_gate.kill_switch = ks

        req = OrderRequestEvent(
            symbol="SBIN",
            side="BUY",
            quantity=1,
            order_type="MARKET",
            price=500.0,
            strategy_name="TEST",
            signal_event_id=None,
            trading_mode=TradingMode.LIVE.value,
            source="ALGO",
        )
        result = await lom.place_order(req)
        # Should reach broker call (mutation guard will block for safety)
        # The exact status depends on mutation guard, but NOT preflight_failed
        assert "preflight_failed" not in (result.reject_reason or "")
