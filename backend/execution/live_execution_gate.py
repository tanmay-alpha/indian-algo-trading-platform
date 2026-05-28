"""backend/execution/live_execution_gate.py

Phase 26A — Live Execution Pre-flight Gate
===========================================
Validates all pre-flight conditions required before a live order is submitted
to the Angel One SmartAPI. This is a dedicated hardening layer between the
ExecutionRouter's mode check and the actual LiveOrderManager.place_order() call.

Safety guarantees:
- Never places, cancels, or modifies any orders.
- Never stores or logs sensitive credential data.
- All failures are structured and loggable as safe messages.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class LivePreflightResult:
    """Result of a live execution pre-flight check."""
    passed: bool
    failed_checks: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)

    @property
    def reason(self) -> Optional[str]:
        if self.failed_checks:
            return "; ".join(self.failed_checks)
        return None


class LiveExecutionGate:
    """
    Pre-flight gate that validates all conditions required for live order submission.

    Checks performed (in order):
    1. live_enabled flag must be True
    2. Kill switch must be inactive
    3. Trading mode must be LIVE
    4. SmartAPI session must be valid and authenticated
    5. Session must have a valid smart_api object with placeOrder callable
    6. Market hours gate (optional — skips if market_watch unavailable)
    7. Max notional guard (from settings)

    Design: Stateless per-call. All state comes from injected dependencies.
    """

    def __init__(
        self,
        kill_switch=None,
        session_manager=None,
        market_watch=None,
        settings=None,
    ):
        self.kill_switch = kill_switch
        self.session_manager = session_manager
        self.market_watch = market_watch
        self.settings = settings

    def evaluate(
        self,
        trading_mode: str,
        live_enabled: bool,
        symbol: Optional[str] = None,
        quantity: Optional[int] = None,
        estimated_notional: Optional[float] = None,
    ) -> LivePreflightResult:
        """
        Evaluate all pre-flight conditions.

        Returns a LivePreflightResult with passed=True only when ALL checks pass.
        """
        failed: list[str] = []
        details: dict = {}

        # --- 1. live_enabled flag ---
        if not live_enabled:
            failed.append("live_trading_disabled")
        details["live_enabled"] = live_enabled

        # --- 2. Kill switch ---
        if self.kill_switch and self.kill_switch.is_active:
            failed.append("kill_switch_active")
            details["kill_switch_reason"] = self.kill_switch.reason

        # --- 3. Trading mode ---
        if trading_mode != "LIVE":
            failed.append(f"wrong_trading_mode:{trading_mode}")
        details["trading_mode"] = trading_mode

        # --- 4. Session validity ---
        session_valid = bool(
            self.session_manager
            and getattr(self.session_manager, "is_valid", False)
        )
        if not session_valid:
            failed.append("session_invalid_or_missing")
        details["session_valid"] = session_valid

        # --- 5. SmartAPI object is callable ---
        smart_api = None
        if self.session_manager:
            smart_api = (
                getattr(self.session_manager, "smart_api", None)
                or getattr(self.session_manager, "smart", None)
            )
        smart_api_ok = bool(smart_api and callable(getattr(smart_api, "placeOrder", None)))
        if not smart_api_ok:
            failed.append("smart_api_not_available")
        details["smart_api_available"] = smart_api_ok

        # --- 6. Market data staleness gate (only if symbol provided) ---
        if symbol and self.market_watch:
            stale = self._is_market_data_stale(symbol)
            details["market_data_stale"] = stale
            if stale:
                failed.append(f"market_data_stale:{symbol}")

        # --- 7. Max notional guard ---
        if estimated_notional is not None and self.settings:
            max_notional = getattr(self.settings, "max_order_notional", None)
            if max_notional and estimated_notional > max_notional:
                failed.append(f"notional_exceeds_limit:{estimated_notional:.0f}>{max_notional:.0f}")
            details["estimated_notional"] = estimated_notional
            details["max_order_notional"] = max_notional

        return LivePreflightResult(
            passed=len(failed) == 0,
            failed_checks=failed,
            details=details,
        )

    def _is_market_data_stale(self, symbol: str) -> bool:
        """Returns True if the latest tick for this symbol is stale or unavailable."""
        try:
            ticks = getattr(self.market_watch, "latest_ticks", None) or {}
            tick = ticks.get(str(symbol).upper())
            if not tick:
                return True  # No tick at all — treat as stale
            received_at = tick.get("received_at")
            if not received_at:
                return True
            parsed = datetime.fromisoformat(str(received_at).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            age_secs = (datetime.now(timezone.utc) - parsed).total_seconds()
            # For live trading, market data older than 30 seconds is stale
            return age_secs > 30.0
        except Exception:
            return True  # Defensive: treat any parse error as stale
