"""backend/execution/paper_execution_config.py

Phase 18K — Paper execution realism settings.

All values are safe paper-mode defaults that can be overridden at construction
time for testing or tweaked via constructor kwargs.  No live trading implications.
No credentials.  No broker API calls.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PaperExecutionConfig:
    """Configurable realism settings for the paper order execution engine.

    Attributes
    ----------
    slippage_bps : int
        Simulated market-impact slippage in basis-points applied to MARKET
        orders.  BUY orders fill above the reference price; SELL orders
        fill below.  Default 5 bps (0.05 %).

    market_hours_enforced : bool
        When True, orders submitted outside NSE regular session hours
        (Mon–Fri 09:15–15:30 IST) are rejected with reason MARKET_CLOSED.
        Set to False for after-hours back-testing or unit tests.  Default True.

    allow_after_hours : bool
        Override for market_hours_enforced: when True, orders are accepted
        regardless of current time.  Useful for tests and paper back-tests.
        Default False.

    NSE session reference: Mon–Fri, 09:15–15:30 Asia/Kolkata.
    """

    slippage_bps: int = 5
    market_hours_enforced: bool = True
    allow_after_hours: bool = False

    # NSE session window (Asia/Kolkata / IST = UTC+05:30)
    SESSION_OPEN_HOUR: int = 9
    SESSION_OPEN_MINUTE: int = 15
    SESSION_CLOSE_HOUR: int = 15
    SESSION_CLOSE_MINUTE: int = 30

    def slippage_factor(self, side: str) -> float:
        """Return the fill-price multiplier for *side*.

        BUY  → 1 + slippage_bps/10000  (fill above reference)
        SELL → 1 - slippage_bps/10000  (fill below reference)
        """
        delta = self.slippage_bps / 10_000
        return (1.0 + delta) if side == "BUY" else (1.0 - delta)
