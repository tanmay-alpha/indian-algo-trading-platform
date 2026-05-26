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
        self.window_size = window_size
        self._prices: dict[str, deque] = {}
        self._vwap: dict[str, float] = {}
        self._last_signals: dict[str, str] = {}
        logger.info(f"STRATEGY: Engine initialized with window size {window_size}")

    def _get_prices(self, symbol: str) -> deque:
        if symbol not in self._prices:
            self._prices[symbol] = deque(maxlen=self.window_size)
        return self._prices[symbol]

    def _get_vwap(self, symbol: str) -> float:
        return self._vwap.get(symbol, 0.0)

    def _get_last_signal(self, symbol: str) -> str:
        return self._last_signals.get(symbol, "NEUTRAL")

    def _set_last_signal(self, symbol: str, signal: str):
        self._last_signals[symbol] = signal

    def generate_signal(self, symbol: str, price: float, vwap: float = None, tick_event_id: str = None) -> SignalEvent:
        """Evaluates price/vwap and returns a SignalEvent wrapper."""
        action = self.update_price(symbol, price, vwap)
        current_vwap = self._get_vwap(symbol)
        return SignalEvent(
            symbol=symbol,
            strategy_name="VWAPMeanReversion",
            action=action,
            strength=1.0,
            reason=f"Deviation evaluated at price {price} relative to VWAP {current_vwap}",
            ltp=price,
            indicators={"vwap": current_vwap},
            source_tick_event_id=tick_event_id,
        )

    def update_price(self, symbol: str, price: float, vwap: float = None):
        """Updates price and VWAP, then evaluates signal."""
        try:
            prices = self._get_prices(symbol)
            prices.append(float(price))
            if vwap is not None:
                self._vwap[symbol] = float(vwap)
            
            warmup_limit = min(5, prices.maxlen or 5)
            if len(prices) < warmup_limit:
                return "NEUTRAL"

            return self.evaluate(symbol)
        except Exception as exc:
            logger.error("STRATEGY Error: %s", exc.__class__.__name__)  # SECURITY: redacted
            return "NEUTRAL"

    def evaluate(self, symbol: str):
        """
        VWAP Mean Reversion Strategy.
        Generates signals based on price deviation from institutional VWAP.
        """
        current_vwap = self._get_vwap(symbol)
        if current_vwap == 0.0:
            return "NEUTRAL"

        prices = self._get_prices(symbol)
        current_price = prices[-1]
        last_signal = self._get_last_signal(symbol)
        
        # Deviation calculation (Threshold 0.15% for HFT-style mean reversion)
        deviation = (current_price - current_vwap) / current_vwap

        if deviation > 0.0015 and last_signal != "SELL":
            self._set_last_signal(symbol, "SELL")
            logger.info(f"SIGNAL: Bearish Deviation detected ({deviation:.4%}). Signal: SELL for {symbol}")
            return "SELL"
        
        elif deviation < -0.0015 and last_signal != "BUY":
            self._set_last_signal(symbol, "BUY")
            logger.info(f"SIGNAL: Bullish Deviation detected ({deviation:.4%}). Signal: BUY for {symbol}")
            return "BUY"

        # Neutralize if returning near VWAP
        if abs(deviation) < 0.0002:
            self._set_last_signal(symbol, "NEUTRAL")

        return self._get_last_signal(symbol)

