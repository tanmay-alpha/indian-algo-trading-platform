import math
from datetime import datetime, timezone
from typing import Any


class ScreenerEngine:
    NOTE = (
        "Screener evaluates only currently loaded candle data. "
        "Symbols must be in your watchlist to have indicator data."
    )

    def __init__(self, indicator_engine, candle_store, market_watch_state):
        self._indicators = indicator_engine
        self._candles = candle_store
        self._mw = market_watch_state

    async def run_screen(
        self,
        filters: dict,
        timeframe: str = "1m",
        limit: int = 50,
    ) -> dict:
        safe_filters = filters or {}
        evaluated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        symbols = self._candle_symbols()
        if len(symbols) <= 1:
            return self._response(safe_filters, timeframe, 0, [], evaluated_at)

        results = []
        evaluated = 0
        for symbol in symbols:
            if len(results) >= max(int(limit or 50), 0):
                break
            try:
                candles = self._candles.get_candles(symbol, timeframe)
                if not candles:
                    continue
                evaluated += 1
                row = self._evaluate_symbol(symbol, candles, safe_filters)
                if row is not None:
                    results.append(row)
            except Exception:
                continue

        return self._response(safe_filters, timeframe, evaluated, results, evaluated_at)

    def _evaluate_symbol(self, symbol: str, candles: list[dict], filters: dict) -> dict | None:
        clean_candles = [self._indicator_candle(candle) for candle in candles if self._valid_candle(candle)]
        if not clean_candles:
            return None

        close = [candle["close"] for candle in clean_candles]
        market = self._market_row(symbol)
        ltp = self._finite_or_none(market.get("ltp")) if market else None
        change_pct = self._finite_or_none(market.get("change_pct")) if market else None
        volume = self._int_or_none(market.get("volume")) if market else None

        indicator_values = self._indicator_values(close, clean_candles, filters)
        if not self._passes_filters(filters, ltp, change_pct, volume, indicator_values):
            return None

        return {
            "symbol": symbol,
            "ltp": ltp,
            "change_pct": change_pct,
            "volume": volume,
            "indicators": {
                "rsi": indicator_values.get("rsi"),
                "ema_20": indicator_values.get("ema_20"),
                "vwap": indicator_values.get("vwap"),
            },
            "is_live": bool(market and market.get("last_update") and not market.get("stale")),
        }

    def _indicator_values(self, close: list[float], candles: list[dict], filters: dict) -> dict:
        values: dict[str, float | None] = {"rsi": None, "ema_20": None, "vwap": None}
        try:
            values["rsi"] = self._latest(self._indicators.rsi(close, 14))
        except Exception:
            values["rsi"] = None

        ema_period = int(filters.get("price_above_ema") or filters.get("price_below_ema") or 20)
        try:
            values["ema_20"] = self._latest(self._indicators.ema(close, ema_period))
        except Exception:
            values["ema_20"] = None

        try:
            values["vwap"] = self._latest(self._indicators.vwap(candles))
        except Exception:
            values["vwap"] = None

        return values

    def _passes_filters(
        self,
        filters: dict,
        ltp: float | None,
        change_pct: float | None,
        volume: int | None,
        indicators: dict[str, float | None],
    ) -> bool:
        rsi = indicators.get("rsi")
        ema = indicators.get("ema_20")
        vwap = indicators.get("vwap")

        if "rsi_below" in filters and not self._lt(rsi, filters["rsi_below"]):
            return False
        if "rsi_above" in filters and not self._gt(rsi, filters["rsi_above"]):
            return False
        if "price_above_ema" in filters and not self._gt(ltp, ema):
            return False
        if "price_below_ema" in filters and not self._lt(ltp, ema):
            return False
        if filters.get("price_above_vwap") is True and not self._gt(ltp, vwap):
            return False
        if filters.get("price_below_vwap") is True and not self._lt(ltp, vwap):
            return False
        if "volume_above" in filters and not self._gt(volume, filters["volume_above"]):
            return False
        if "change_pct_above" in filters and not self._gt(change_pct, filters["change_pct_above"]):
            return False
        if "change_pct_below" in filters and not self._lt(change_pct, filters["change_pct_below"]):
            return False
        return True

    def _candle_symbols(self) -> list[str]:
        try:
            stats = self._candles.stats()
            return list(stats.get("symbols") or [])
        except Exception:
            return []

    def _market_row(self, symbol: str) -> dict:
        if self._mw is None or not hasattr(self._mw, "snapshot"):
            return {}
        try:
            for row in self._mw.snapshot():
                if str(row.get("symbol") or "").upper() == symbol.upper():
                    return row
        except Exception:
            return {}
        return {}

    def _response(self, filters: dict, timeframe: str, evaluated: int, results: list[dict], evaluated_at: str) -> dict:
        return {
            "filters_applied": filters,
            "timeframe": timeframe,
            "symbols_evaluated": evaluated,
            "symbols_passed": len(results),
            "results": results,
            "note": self.NOTE,
            "evaluated_at": evaluated_at,
        }

    @staticmethod
    def _valid_candle(candle: dict) -> bool:
        return all(key in candle for key in ("open", "high", "low", "close"))

    @staticmethod
    def _indicator_candle(candle: dict) -> dict[str, float]:
        return {
            "open": float(candle["open"]),
            "high": float(candle["high"]),
            "low": float(candle["low"]),
            "close": float(candle["close"]),
            "volume": float(candle.get("volume") or 0),
        }

    @classmethod
    def _latest(cls, values: list[float]) -> float | None:
        for value in reversed(values or []):
            parsed = cls._finite_or_none(value)
            if parsed is not None:
                return parsed
        return None

    @staticmethod
    def _finite_or_none(value: Any) -> float | None:
        try:
            parsed = float(value)
            return parsed if math.isfinite(parsed) else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _int_or_none(value: Any) -> int | None:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @classmethod
    def _gt(cls, left: Any, right: Any) -> bool:
        lval = cls._finite_or_none(left)
        rval = cls._finite_or_none(right)
        return lval is not None and rval is not None and lval > rval

    @classmethod
    def _lt(cls, left: Any, right: Any) -> bool:
        lval = cls._finite_or_none(left)
        rval = cls._finite_or_none(right)
        return lval is not None and rval is not None and lval < rval

