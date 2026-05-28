"""backend/execution/live_safety_monitor.py

Phase 24C — Live Safety Monitor
================================
Automated watchdog that continuously monitors the system for safety anomalies
and auto-triggers the kill switch when thresholds are breached.

Safety guarantees:
- Never places, cancels, or modifies any orders.
- Never contacts any broker API directly.
- Only reads state (reconciliation reports, OMS status, PnL).
- Kill switch activation is always logged with a reason.
- All thresholds are configurable; defaults are conservative.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LiveSafetyMonitorConfig:
    """Threshold configuration for the safety monitor."""

    def __init__(
        self,
        *,
        max_daily_loss_pct: float = 2.0,        # auto-kill if daily loss > 2% of capital
        max_open_orders: int = 5,                # auto-kill if > 5 open orders simultaneously
        reconciliation_anomaly_threshold: int = 3,  # auto-kill after N consecutive anomalies
        poll_interval_seconds: float = 30.0,    # how often the monitor checks
        stale_market_seconds: float = 60.0,     # how long before market data is "stale" for live
    ):
        self.max_daily_loss_pct = max_daily_loss_pct
        self.max_open_orders = max_open_orders
        self.reconciliation_anomaly_threshold = reconciliation_anomaly_threshold
        self.poll_interval_seconds = poll_interval_seconds
        self.stale_market_seconds = stale_market_seconds


class LiveSafetyMonitor:
    """Automated safety watchdog for live trading.

    Runs as a background asyncio task. Evaluates a set of safety checks on
    every poll cycle and activates the kill switch if any threshold is breached.

    Designed to compose cleanly with the existing KillSwitch and ExecutionRouter.
    """

    def __init__(
        self,
        kill_switch,
        order_state_machine=None,
        portfolio_manager=None,
        order_store=None,
        config: Optional[LiveSafetyMonitorConfig] = None,
        event_bus=None,
    ):
        self.kill_switch = kill_switch
        self.order_state_machine = order_state_machine
        self.portfolio_manager = portfolio_manager
        self.order_store = order_store
        self.config = config or LiveSafetyMonitorConfig()
        self.event_bus = event_bus

        self._task: Optional[asyncio.Task] = None
        self._consecutive_anomalies: int = 0
        self._total_activations: int = 0
        self._check_history: list[dict] = []
        self._started_at: Optional[str] = None
        self._last_check_at: Optional[str] = None
        self._last_check_passed: bool = True

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the background monitoring loop."""
        if self._task and not self._task.done():
            logger.debug("LiveSafetyMonitor: already running, skipping re-start.")
            return
        self._started_at = _utc_now()
        self._task = asyncio.create_task(self._loop(), name="live_safety_monitor")
        logger.info("LiveSafetyMonitor: started (poll_interval=%.0fs)", self.config.poll_interval_seconds)

    async def stop(self) -> None:
        """Stop the background monitoring loop gracefully."""
        if not self._task:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None
        logger.info("LiveSafetyMonitor: stopped.")

    # ------------------------------------------------------------------
    # Core check cycle
    # ------------------------------------------------------------------

    async def run_checks(self) -> dict:
        """
        Run all safety checks once and return a summary.
        Auto-activates kill switch if any breach is detected.
        """
        self._last_check_at = _utc_now()
        triggered_reasons: list[str] = []
        checks: dict[str, dict] = {}

        # --- Check 1: Kill switch already active (skip further checks) ---
        if self.kill_switch.is_active:
            checks["kill_switch"] = {"status": "ALREADY_ACTIVE", "passed": True}
            self._last_check_passed = True
            self._record_check(triggered_reasons, checks)
            return self._summary(triggered_reasons, checks)

        # --- Check 2: Open orders count ---
        checks["open_orders"] = self._check_open_orders()
        if not checks["open_orders"]["passed"]:
            triggered_reasons.append(checks["open_orders"]["reason"])

        # --- Check 3: Daily loss threshold ---
        checks["daily_loss"] = self._check_daily_loss()
        if not checks["daily_loss"]["passed"]:
            triggered_reasons.append(checks["daily_loss"]["reason"])

        # --- Check 4: OMS consistency ---
        checks["oms_consistency"] = self._check_oms_consistency()
        if not checks["oms_consistency"]["passed"]:
            triggered_reasons.append(checks["oms_consistency"]["reason"])
            self._consecutive_anomalies += 1
        else:
            self._consecutive_anomalies = max(0, self._consecutive_anomalies - 1)

        # --- Check 5: Consecutive anomaly threshold ---
        if self._consecutive_anomalies >= self.config.reconciliation_anomaly_threshold:
            triggered_reasons.append(
                f"consecutive_anomalies_exceeded:{self._consecutive_anomalies}"
            )

        all_passed = len(triggered_reasons) == 0
        self._last_check_passed = all_passed

        if not all_passed:
            reason_str = " | ".join(triggered_reasons)
            logger.warning("LiveSafetyMonitor: BREACH detected — activating kill switch. Reasons: %s", reason_str)
            self.kill_switch.activate(
                reason=f"auto_monitor: {reason_str}",
                source="LIVE_SAFETY_MONITOR",
            )
            self._total_activations += 1
            if self.event_bus:
                try:
                    from backend.core.events import ErrorEvent
                    await self.event_bus.publish(
                        ErrorEvent(
                            component="LIVE_SAFETY_MONITOR",
                            error_type="SAFETY_BREACH",
                            safe_message=f"Kill switch auto-activated: {reason_str}",
                            severity="CRITICAL",
                        )
                    )
                except Exception:
                    pass

        self._record_check(triggered_reasons, checks)
        return self._summary(triggered_reasons, checks)

    # ------------------------------------------------------------------
    # Individual checks
    # ------------------------------------------------------------------

    def _check_open_orders(self) -> dict:
        """Check if open order count exceeds threshold."""
        if not self.order_state_machine:
            return {"passed": True, "value": None, "threshold": self.config.max_open_orders,
                    "detail": "order_state_machine unavailable, check skipped"}
        try:
            pending = self.order_state_machine.pending_orders()
            open_orders = self.order_state_machine.open_orders()
            count = len(pending) + len(open_orders)
            passed = count <= self.config.max_open_orders
            return {
                "passed": passed,
                "value": count,
                "threshold": self.config.max_open_orders,
                "detail": f"{count} open/pending orders",
                **({"reason": f"open_orders_exceeded:{count}"} if not passed else {}),
            }
        except Exception as exc:
            return {"passed": True, "value": None, "threshold": self.config.max_open_orders,
                    "detail": f"check_error:{exc.__class__.__name__}"}

    def _check_daily_loss(self) -> dict:
        """Check if daily loss exceeds configured percentage threshold."""
        if not self.portfolio_manager:
            return {"passed": True, "value": None, "detail": "portfolio_manager unavailable, check skipped"}
        try:
            daily_pnl = (
                getattr(self.portfolio_manager, "current_daily_pnl", None)
                or getattr(self.portfolio_manager, "daily_pnl", None)
                or 0.0
            )
            initial_capital = getattr(self.portfolio_manager, "initial_capital", None) or 50000.0
            if daily_pnl >= 0:
                return {"passed": True, "value": daily_pnl, "detail": "no loss today"}
            loss_pct = abs(daily_pnl) / initial_capital * 100.0
            passed = loss_pct <= self.config.max_daily_loss_pct
            return {
                "passed": passed,
                "value": round(loss_pct, 4),
                "threshold": self.config.max_daily_loss_pct,
                "daily_pnl": round(daily_pnl, 4),
                "detail": f"daily loss {loss_pct:.2f}% vs threshold {self.config.max_daily_loss_pct}%",
                **({"reason": f"daily_loss_exceeded:{loss_pct:.2f}pct"} if not passed else {}),
            }
        except Exception as exc:
            return {"passed": True, "value": None, "detail": f"check_error:{exc.__class__.__name__}"}

    def _check_oms_consistency(self) -> dict:
        """Check for OMS-level inconsistencies (orphaned PENDING rows in DB)."""
        if not self.order_store:
            return {"passed": True, "detail": "order_store unavailable, check skipped"}
        try:
            active_rows = self.order_store.get_active_requests()
            in_memory_ids: set[str] = set()
            if self.order_state_machine:
                for o in self.order_state_machine.pending_orders() + self.order_state_machine.open_orders():
                    rid = getattr(o, "intent_id", None) or getattr(o, "order_id", None)
                    if rid:
                        in_memory_ids.add(rid)

            db_ids = {row.get("request_id") for row in active_rows if row.get("request_id")}
            orphaned = db_ids - in_memory_ids
            passed = len(orphaned) == 0
            return {
                "passed": passed,
                "db_active_count": len(db_ids),
                "in_memory_count": len(in_memory_ids),
                "orphaned_count": len(orphaned),
                "detail": f"{len(orphaned)} orphaned DB rows vs in-memory state",
                **({"reason": f"oms_orphaned_orders:{len(orphaned)}"} if not passed else {}),
            }
        except Exception as exc:
            return {"passed": True, "detail": f"check_error:{exc.__class__.__name__}"}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        while True:
            try:
                await self.run_checks()
            except Exception as exc:
                logger.error("LiveSafetyMonitor: unexpected error in check loop: %s", exc.__class__.__name__)
            await asyncio.sleep(self.config.poll_interval_seconds)

    def _record_check(self, reasons: list[str], checks: dict) -> None:
        record = {
            "ts": self._last_check_at,
            "passed": len(reasons) == 0,
            "triggered_reasons": reasons,
            "checks": checks,
        }
        self._check_history.append(record)
        # Keep last 50 records only
        if len(self._check_history) > 50:
            self._check_history = self._check_history[-50:]

    def _summary(self, reasons: list[str], checks: dict) -> dict:
        return {
            "ts": self._last_check_at,
            "all_passed": len(reasons) == 0,
            "triggered_reasons": reasons,
            "consecutive_anomalies": self._consecutive_anomalies,
            "total_activations": self._total_activations,
            "checks": checks,
        }

    def status(self) -> dict:
        """Return current monitor status for API exposure."""
        return {
            "running": self._task is not None and not self._task.done(),
            "started_at": self._started_at,
            "last_check_at": self._last_check_at,
            "last_check_passed": self._last_check_passed,
            "consecutive_anomalies": self._consecutive_anomalies,
            "total_auto_activations": self._total_activations,
            "config": {
                "max_daily_loss_pct": self.config.max_daily_loss_pct,
                "max_open_orders": self.config.max_open_orders,
                "reconciliation_anomaly_threshold": self.config.reconciliation_anomaly_threshold,
                "poll_interval_seconds": self.config.poll_interval_seconds,
            },
            "recent_checks": self._check_history[-5:],
        }
