"""backend/services/live_execution_service.py

Phase 26B — Live Execution Service
====================================
Orchestrates the full live execution lifecycle:
- Live mode enable/disable toggle (with safety interlocks)
- OrderPoller lifecycle management (start/stop with mode transitions)
- Live status aggregation for API exposure

Safety guarantees:
- Never places, cancels, or modifies any orders directly.
- Live enable requires explicit confirmation flag.
- Kill switch must be inactive before enabling live.
- OrderPoller is auto-stopped when mode returns to PAPER.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LiveExecutionService:
    """
    Centralised service managing the live execution lifecycle.

    Responsibilities:
    1. Toggle live mode with safety interlocks (kill switch, session, open orders)
    2. Start/stop OrderPoller when mode transitions to/from LIVE
    3. Surface aggregated live status for the API router
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

    # ------------------------------------------------------------------
    # Mode toggling
    # ------------------------------------------------------------------

    async def enable_live(self, confirm: bool = False, source: str = "ADMIN") -> dict:
        """
        Enable live trading mode with full safety interlock validation.

        Requires:
        - confirm=True (explicit double-confirmation)
        - Kill switch must be inactive
        - A valid broker session
        - No pending/open orders in the state machine
        - No existing open positions
        """
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
        Disable live trading (switch to PAPER) and stop the OrderPoller.
        Always succeeds — there is no reason to block switching to PAPER.
        """
        if self.execution_router:
            await self.execution_router.switch_to_paper()

        await self._stop_poller()
        self._record_mode("LIVE_DISABLED", source, [])
        logger.info("LiveExecutionService: mode switched to PAPER by source=%s", source)
        return {"success": True, "mode": "PAPER", "poller_running": self._poller_running}

    # ------------------------------------------------------------------
    # OrderPoller lifecycle
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Status aggregation
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        """Return full live execution status for API exposure."""
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
        }

        # Order counts from state machine
        if router and hasattr(router, "order_state_machine"):
            osm = router.order_state_machine
            try:
                status["open_orders"] = len(osm.open_orders())
                status["pending_orders"] = len(osm.pending_orders())
            except Exception:
                pass

        # Safety monitor status
        if self.live_safety_monitor:
            status["safety_monitor"] = self.live_safety_monitor.status()

        return status

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

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
