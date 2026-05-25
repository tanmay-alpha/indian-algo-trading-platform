# backend/engine/strategy_engine.py

from collections import deque
import logging

from backend.core.events import SignalEvent

logger = logging.getLogger(__name__)

class StrategyEngine:
    """
    Quant Strategy Engine. 
    Implements institutional VWAP Mean Reversion.
    High-frequency ready for C++ bridge integration.
    """
    def __init__(self, window_size=50):
        self.prices = deque(maxlen=window_size)
        self.current_vwap = 0.0
        self.last_signal = "NEUTRAL"
        logger.info(f"STRATEGY: Engine initialized with window size {window_size}")

    def generate_signal(self, symbol: str, price: float, vwap: float = None, tick_event_id: str = None) -> SignalEvent:
        """Evaluates price/vwap and returns a SignalEvent wrapper."""
        action = self.update_price(price, vwap)
        return SignalEvent(
            symbol=symbol,
            strategy_name="VWAPMeanReversion",
            action=action,
            strength=1.0,
            reason=f"Deviation evaluated at price {price} relative to VWAP {self.current_vwap}",
            ltp=price,
            indicators={"vwap": self.current_vwap},
            source_tick_event_id=tick_event_id,
        )


    def update_price(self, price: float, vwap: float = None):
        """Updates price and VWAP, then evaluates signal."""
        try:
            self.prices.append(float(price))
            if vwap is not None:
                self.current_vwap = float(vwap)
            
            warmup_limit = min(5, self.prices.maxlen or 5)
            if len(self.prices) < warmup_limit:
                return "NEUTRAL"

            return self.evaluate()
        except Exception as exc:
            logger.error("STRATEGY Error: %s", exc.__class__.__name__)  # SECURITY: redacted
            return "NEUTRAL"

    def evaluate(self):
        """
        VWAP Mean Reversion Strategy.
        Generates signals based on price deviation from institutional VWAP.
        """
        if self.current_vwap == 0.0:
            return "NEUTRAL"

        current_price = self.prices[-1]
        
        # Deviation calculation (Threshold 0.15% for HFT-style mean reversion)
        deviation = (current_price - self.current_vwap) / self.current_vwap

        if deviation > 0.0015 and self.last_signal != "SELL":
            self.last_signal = "SELL"
            logger.info(f"SIGNAL: Bearish Deviation detected ({deviation:.4%}). Signal: SELL")
            return "SELL"
        
        elif deviation < -0.0015 and self.last_signal != "BUY":
            self.last_signal = "BUY"
            logger.info(f"SIGNAL: Bullish Deviation detected ({deviation:.4%}). Signal: BUY")
            return "BUY"

        # Neutralize if returning near VWAP
        if abs(deviation) < 0.0002:
            self.last_signal = "NEUTRAL"

        return self.last_signal

