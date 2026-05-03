from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

from backend.core.events import TickEvent


class CandleStore:
    MAX_CANDLES = {
        "1m": 390,
        "5m": 390,
        "15m": 260,
        "1h": 200,
        "1d": 252,
    }

    def __init__(self):
        self._candles: dict[str, dict[str, deque]] = defaultdict(
            lambda: {timeframe: deque(maxlen=self.MAX_CANDLES[timeframe]) for timeframe in self.MAX_CANDLES}
        )
        self._live_candle: dict[str, dict[str, Optional[dict]]] = defaultdict(
            lambda: {timeframe: None for timeframe in self.MAX_CANDLES}
        )

    async def on_tick_event(self, event: TickEvent) -> None:
        if not event.symbol or event.ltp is None:
            return
        self._update_live_candle(event.symbol, event.ltp, event.volume or 0, event.received_at)

    def _update_live_candle(self, symbol: str, price: float, volume: int, received_at: datetime) -> None:
        normalized_symbol = str(symbol or "").strip().upper()
        if not normalized_symbol:
            return

        price_value = float(price)
        volume_value = int(volume or 0)

        for timeframe in self.MAX_CANDLES:
            bucket = self._bucket_start(received_at, timeframe)
            live = self._live_candle[normalized_symbol][timeframe]

            if live is None:
                self._live_candle[normalized_symbol][timeframe] = self._new_candle(
                    bucket, price_value, volume_value
                )
                continue

            if live["time"] == bucket:
                live["high"] = max(live["high"], price_value)
                live["low"] = min(live["low"], price_value)
                live["close"] = price_value
                # TODO: compute per-candle volume once previous cumulative volume is tracked.
                live["volume"] = volume_value
                continue

            if live["time"] < bucket:
                self._candles[normalized_symbol][timeframe].append(live.copy())
                self._live_candle[normalized_symbol][timeframe] = self._new_candle(
                    bucket, price_value, volume_value
                )

    def load_historical(self, symbol: str, timeframe: str, candles: list[dict]) -> int:
        self._validate_timeframe(timeframe)
        normalized_symbol = str(symbol or "").strip().upper()
        if not normalized_symbol:
            return 0

        merged: dict[int, dict] = {}
        for existing in self._candles[normalized_symbol][timeframe]:
            merged[int(existing["time"])] = self._clean_candle(existing)
        for candle in candles:
            clean = self._clean_candle(candle)
            if clean:
                merged[int(clean["time"])] = clean

        sorted_candles = [merged[key] for key in sorted(merged)]
        max_count = self.MAX_CANDLES[timeframe]
        self._candles[normalized_symbol][timeframe] = deque(sorted_candles[-max_count:], maxlen=max_count)
        return len(self._candles[normalized_symbol][timeframe])

    def get_candles(self, symbol: str, timeframe: str, limit: Optional[int] = None) -> list[dict]:
        self._validate_timeframe(timeframe)
        normalized_symbol = str(symbol or "").strip().upper()
        candles = [item.copy() for item in self._candles[normalized_symbol][timeframe]]

        live = self._live_candle[normalized_symbol][timeframe]
        if live is not None:
            live_copy = live.copy()
            live_copy["is_live"] = True
            candles.append(live_copy)

        if limit is not None:
            candles = candles[-max(int(limit), 0):]
        return candles

    def get_latest_candle(self, symbol: str, timeframe: str) -> Optional[dict]:
        candles = self.get_candles(symbol, timeframe, limit=1)
        return candles[-1] if candles else None

    def symbol_has_data(self, symbol: str, timeframe: str) -> bool:
        return bool(self.get_candles(symbol, timeframe, limit=1))

    def stats(self) -> dict:
        symbols = sorted(set(self._candles.keys()) | set(self._live_candle.keys()))
        candle_counts = {}
        for symbol in symbols:
            candle_counts[symbol] = {}
            for timeframe in self.MAX_CANDLES:
                count = len(self._candles[symbol][timeframe])
                if self._live_candle[symbol][timeframe] is not None:
                    count += 1
                candle_counts[symbol][timeframe] = count
        return {"symbols": symbols, "candle_counts": candle_counts}

    @staticmethod
    def _bucket_start(dt: datetime, timeframe: str) -> int:
        if timeframe not in CandleStore.MAX_CANDLES:
            raise ValueError(f"Unsupported timeframe: {timeframe}")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        timestamp = int(dt.timestamp())
        interval_seconds = {
            "1m": 60,
            "5m": 5 * 60,
            "15m": 15 * 60,
            "1h": 60 * 60,
            "1d": 24 * 60 * 60,
        }[timeframe]
        return (timestamp // interval_seconds) * interval_seconds

    @staticmethod
    def _new_candle(time_value: int, price: float, volume: int) -> dict:
        return {
            "time": int(time_value),
            "open": float(price),
            "high": float(price),
            "low": float(price),
            "close": float(price),
            "volume": int(volume or 0),
        }

    @classmethod
    def _clean_candle(cls, candle: dict) -> Optional[dict]:
        try:
            return {
                "time": int(candle["time"]),
                "open": float(candle["open"]),
                "high": float(candle["high"]),
                "low": float(candle["low"]),
                "close": float(candle["close"]),
                "volume": int(candle.get("volume") or 0),
            }
        except (KeyError, TypeError, ValueError):
            return None

    @classmethod
    def _validate_timeframe(cls, timeframe: str) -> None:
        if timeframe not in cls.MAX_CANDLES:
            raise ValueError(f"Unsupported timeframe: {timeframe}")
