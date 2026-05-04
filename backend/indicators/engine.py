from typing import Any

from backend.indicators import cpp_bridge, python_fallback
from backend.indicators.types import CandleInput


class IndicatorEngine:
    def __init__(self, prefer_cpp: bool = True):
        self._use_cpp = prefer_cpp and cpp_bridge.cpp_available()
        self._engine = cpp_bridge if self._use_cpp else python_fallback
        self.selected_engine = "cpp" if self._use_cpp else "python"

    def status(self) -> dict[str, Any]:
        return {
            "selected_engine": self.selected_engine,
            "cpp_available": cpp_bridge.cpp_available(),
            "fallback_available": True,
            "indicators": python_fallback.INDICATORS.copy(),
            "cpp_import_error": cpp_bridge.cpp_import_error(),
        }

    def sma(self, values: list[float], period: int) -> list[float]:
        return self._engine.sma(values, period)

    def ema(self, values: list[float], period: int) -> list[float]:
        return self._engine.ema(values, period)

    def rsi(self, close: list[float], period: int = 14) -> list[float]:
        return self._engine.rsi(close, period)

    def macd(
        self,
        close: list[float],
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
    ) -> dict[str, list[float]]:
        return self._engine.macd(close, fast_period, slow_period, signal_period)

    def atr(self, candles: list[CandleInput], period: int = 14) -> list[float]:
        return self._engine.atr(candles, period)

    def vwap(self, candles: list[CandleInput]) -> list[float]:
        return self._engine.vwap(candles)

    def bollinger_bands(
        self,
        close: list[float],
        period: int = 20,
        stddev_multiplier: float = 2.0,
    ) -> dict[str, list[float]]:
        return self._engine.bollinger_bands(close, period, stddev_multiplier)

    def calculate(
        self,
        close: list[float] | None = None,
        candles: list[CandleInput] | None = None,
        indicators: list[str] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        requested = indicators or []
        options = params or {}
        results: dict[str, Any] = {}

        for indicator in requested:
            key = indicator.lower()
            try:
                if key == "sma":
                    results[key] = self._require_close(close, key, self.sma)(
                        close or [], int(options.get("sma_period", 20))
                    )
                elif key == "ema":
                    results[key] = self._require_close(close, key, self.ema)(
                        close or [], int(options.get("ema_period", 20))
                    )
                elif key == "rsi":
                    results[key] = self._require_close(close, key, self.rsi)(
                        close or [], int(options.get("rsi_period", 14))
                    )
                elif key == "macd":
                    results[key] = self._require_close(close, key, self.macd)(
                        close or [],
                        int(options.get("macd_fast", 12)),
                        int(options.get("macd_slow", 26)),
                        int(options.get("macd_signal", 9)),
                    )
                elif key == "atr":
                    results[key] = self._require_candles(candles, key, self.atr)(
                        candles or [], int(options.get("atr_period", 14))
                    )
                elif key == "vwap":
                    results[key] = self._require_candles(candles, key, self.vwap)(candles or [])
                elif key == "bollinger_bands":
                    results[key] = self._require_close(close, key, self.bollinger_bands)(
                        close or [],
                        int(options.get("bb_period", 20)),
                        float(options.get("bb_stddev", 2.0)),
                    )
                else:
                    results[key] = {"error": "unsupported_indicator"}
            except Exception as exc:
                results[key] = {"error": exc.__class__.__name__}

        return {"engine": self.selected_engine, "results": results}

    @staticmethod
    def _require_close(close: list[float] | None, indicator: str, fn):
        if close is None:
            raise ValueError(f"{indicator} requires close data")
        return fn

    @staticmethod
    def _require_candles(candles: list[CandleInput] | None, indicator: str, fn):
        if candles is None:
            raise ValueError(f"{indicator} requires candle data")
        return fn
