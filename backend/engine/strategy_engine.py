# backend/engine/strategy_engine.py

from collections import deque
import numpy as np
import logging

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

    def update_price(self, price: float, vwap: float = None):
        """Updates price and VWAP, then evaluates signal."""
        try:
            self.prices.append(float(price))
            if vwap:
                self.current_vwap = float(vwap)
            
            if len(self.prices) < 5:
                return "NEUTRAL"

            return self.evaluate()
        except Exception as e:
            logger.error(f"STRATEGY Error: {e}")
            return "NEUTRAL"

    def evaluate(self):
        """
        VWAP Mean Reversion Strategy.
        Generates signals based on price deviation from institutional VWAP.
        """
        if self.current_vwap == 0:
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