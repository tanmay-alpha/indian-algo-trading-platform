"""backend/services/live_execution_service.py

Phase 26-Safety-Rollback — Live Execution Service (LOCKED DOWN)
================================================================
All execution-enabling methods check `settings.live_execution_build_enabled`.
If False (default), they block execution proactively.
Only read-only / deactivation paths (disable_live) are always available.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from backend.core.live_build_policy import is_live_execution_build_enabled

logger = logging.getLogger(__name__)

_POLICY_RESPONSE = {
    "success": False,
    "enabled": False,
    "live_execution_enabled": False,
    "status": "DISABLED_BY_POLICY",
    "reason": (
        "Live execution is not enabled in this build. "
        "Pending advisory-only Phase 24C / 26A / 26B sprint audit. "
        "See phase-26-safety-rollback."
    ),
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LiveExecutionService:
    """
    Centralised service managing the live execution lifecycle.
    Locked down by default under `live_execution_build_enabled=False`.
    """

    def __init__(
        self,
        execution_router=None,
        order_poller=None,
        kill_switch=None,
        session_manager=None,
        event_bus=None,
        live_safety_monitor=None,
    ):
        self.execution_router = execution_router
        self.order_poller = order_poller
        self.kill_switch = kill_switch
        self.session_manager = session_manager
        self.event_bus = event_bus
        self.live_safety_monitor = live_safety_monitor

        self._mode_history: list[dict] = []
        self._poller_running: bool = False

    async def enable_live(self, confirm: bool = False, source: str = "ADMIN") -> dict:
        """
        Enable live trading mode.
        If live_execution_build_enabled is False, this is blocked by policy.
        """
        if not is_live_execution_build_enabled():
            logger.warning(
                "LiveExecutionService.enable_live() called by source=%s — BLOCKED BY POLICY "
                "(live_execution_build_enabled=False)",
                source,
            )
            self._record_mode("LIVE_ENABLE_BLOCKED_BY_POLICY", source, ["live_execution_build_disabled"])
            return {**_POLICY_RESPONSE, "mode": self._current_mode(), "success": False}

        if not confirm:
            return {
                "success": False,
                "reason": "confirm=True is required to enable live trading",
                "mode": self._current_mode(),
            }

        failed: list[str] = []

        # Kill switch check
        if self.kill_switch and self.kill_switch.is_active:
            failed.append(f"kill_switch_active: {self.kill_switch.reason}")

        # Session validity
        session_valid = bool(
            self.session_manager
            and getattr(self.session_manager, "is_valid", False)
        )
        if not session_valid:
            failed.append("broker_session_invalid")

        # Delegate to router for final switch
        if not failed and self.execution_router:
            switched = await self.execution_router.switch_to_live(confirm=True)
            if not switched:
                failed.append("execution_router_rejected_live_switch")

        if failed:
            logger.warning("LiveExecutionService: enable_live REJECTED by source=%s | %s", source, failed)
            self._record_mode("LIVE_ENABLE_REJECTED", source, failed)
            return {
                "success": False,
                "reason": " | ".join(failed),
                "mode": self._current_mode(),
            }

        # Start OrderPoller
        await self._start_poller()
        self._record_mode("LIVE_ENABLED", source, [])
        logger.info("LiveExecutionService: LIVE mode enabled by source=%s", source)
        return {"success": True, "mode": "LIVE", "poller_running": self._poller_running}

    async def disable_live(self, source: str = "ADMIN") -> dict:
        """
        Disable live trading and switch to PAPER mode.
        Always safe to execute.
        """
        if self.execution_router:
            await self.execution_router.switch_to_paper()

        await self._stop_poller()
        self._record_mode("LIVE_DISABLED", source, [])
        logger.info("LiveExecutionService: mode switched to PAPER by source=%s", source)
        return {"success": True, "mode": "PAPER", "poller_running": self._poller_running}

    async def _start_poller(self) -> None:
        if not self.order_poller:
            logger.debug("LiveExecutionService: no order_poller configured, skipping start.")
            return
        try:
            await self.order_poller.start()
            self._poller_running = True
            logger.info("LiveExecutionService: OrderPoller started for LIVE mode.")
        except Exception as exc:
            logger.error("LiveExecutionService: Failed to start OrderPoller: %s", exc.__class__.__name__)
            self._poller_running = False

    async def _stop_poller(self) -> None:
        if not self.order_poller:
            return
        try:
            await self.order_poller.stop()
            self._poller_running = False
            logger.info("LiveExecutionService: OrderPoller stopped.")
        except Exception as exc:
            logger.error("LiveExecutionService: Failed to stop OrderPoller: %s", exc.__class__.__name__)

    def get_status(self) -> dict:
        from backend.core.config import settings
        router = self.execution_router
        ks = self.kill_switch

        mode = self._current_mode()
        live_enabled = getattr(router, "live_enabled", False) if router else False
        session_valid = bool(
            self.session_manager
            and getattr(self.session_manager, "is_valid", False)
        )

        status = {
            "mode": mode,
            "live_enabled": live_enabled,
            "session_valid": session_valid,
            "poller_running": self._poller_running,
            "kill_switch": ks.status() if ks else {"active": True, "reason": "unavailable"},
            "mode_history": self._mode_history[-10:],
            "live_execution_build_enabled": is_live_execution_build_enabled(),
        }

        # Order counts from state machine
        if router and hasattr(router, "order_state_machine"):
            osm = router.order_state_machine
            try:
                status["open_orders"] = len(osm.open_orders())
                status["pending_orders"] = len(osm.pending_orders())
            except Exception:
                pass

        if self.live_safety_monitor:
            status["safety_monitor"] = self.live_safety_monitor.status()

        return status

    def _current_mode(self) -> str:
        if self.execution_router:
            return getattr(self.execution_router, "mode", "PAPER")
        return "PAPER"

    def _record_mode(self, action: str, source: str, reasons: list[str]) -> None:
        self._mode_history.append({
            "ts": _utc_now(),
            "action": action,
            "source": source,
            "reasons": reasons,
        })
        if len(self._mode_history) > 50:
            self._mode_history = self._mode_history[-50:]
