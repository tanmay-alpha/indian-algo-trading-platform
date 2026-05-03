import asyncio
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from loguru import logger

from backend.candles.candle_store import CandleStore


IST = timezone(timedelta(hours=5, minutes=30))


class CandleFetcher:
    INTERVAL_MAP = {
        "1m": "ONE_MINUTE",
        "5m": "FIVE_MINUTE",
        "15m": "FIFTEEN_MINUTE",
        "1h": "ONE_HOUR",
        "1d": "ONE_DAY",
    }

    def __init__(self, session_manager, candle_store: CandleStore, registry):
        self._session = session_manager
        self._store = candle_store
        self._registry = registry

    async def fetch_and_load(
        self,
        symbol: str,
        timeframe: str,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> dict:
        normalized_symbol = str(symbol or "").strip().upper()
        from_dt = from_dt or self._default_from_dt()
        to_dt = to_dt or datetime.now(IST).astimezone(timezone.utc)

        result = {
            "symbol": normalized_symbol,
            "timeframe": timeframe,
            "fetched": 0,
            "loaded": 0,
            "from_dt": from_dt.isoformat(),
            "to_dt": to_dt.isoformat(),
            "error": None,
        }

        try:
            if timeframe not in self.INTERVAL_MAP:
                result["error"] = "invalid_timeframe"
                return result

            instrument = self._get_instrument(normalized_symbol)
            if not instrument:
                result["error"] = "unknown_symbol"
                return result

            token = self._get_token(normalized_symbol)
            if not token:
                result["error"] = "missing_symbol_token"
                return result

            if not self._session or not self._session.is_valid:
                result["error"] = "session_not_valid"
                return result

            smart_api = getattr(self._session, "smart_api", None)
            if smart_api is None:
                result["error"] = "smart_api_unavailable"
                return result

            params = {
                "exchange": instrument.get("exchange") or "NSE",
                "symboltoken": str(token),
                "interval": self.INTERVAL_MAP[timeframe],
                "fromdate": self._format_angel_datetime(from_dt),
                "todate": self._format_angel_datetime(to_dt),
            }

            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, lambda: smart_api.getCandleData(params))

            if not isinstance(response, dict) or response.get("status") is not True:
                result["error"] = str(response.get("message") or "candle_fetch_failed") if isinstance(response, dict) else "candle_fetch_failed"
                return result

            rows = response.get("data") or []
            candles = []
            for row in rows:
                parsed = self._parse_angel_candle_row(row)
                if parsed:
                    candles.append(parsed)

            result["fetched"] = len(rows)
            result["loaded"] = self._store.load_historical(normalized_symbol, timeframe, candles)
            if not candles:
                result["error"] = "no_data"
            return result
        except Exception as exc:
            logger.error(f"CANDLE_FETCHER: Fetch failed for {normalized_symbol}: {exc.__class__.__name__}")
            result["error"] = exc.__class__.__name__
            return result

    async def fetch_today(self, symbol: str, timeframe: str) -> dict:
        return await self.fetch_and_load(
            symbol=symbol,
            timeframe=timeframe,
            from_dt=self._default_from_dt(),
            to_dt=datetime.now(IST).astimezone(timezone.utc),
        )

    @staticmethod
    def _parse_angel_candle_row(row: list) -> Optional[dict]:
        try:
            if not isinstance(row, list) or len(row) < 6:
                return None
            candle_dt = datetime.fromisoformat(str(row[0]))
            if candle_dt.tzinfo is None:
                candle_dt = candle_dt.replace(tzinfo=IST)
            candle_dt = candle_dt.astimezone(timezone.utc)
            return {
                "time": int(candle_dt.timestamp()),
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": int(row[5] or 0),
            }
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _default_from_dt() -> datetime:
        today_ist = datetime.now(IST).date()
        market_open_ist = datetime.combine(today_ist, time(9, 15), tzinfo=IST)
        return market_open_ist.astimezone(timezone.utc)

    def _get_instrument(self, symbol: str) -> Optional[dict]:
        getter = getattr(self._registry, "get_instrument", None)
        return getter(symbol) if callable(getter) else None

    def _get_token(self, symbol: str) -> Optional[str]:
        getter = getattr(self._registry, "get_token", None)
        token = getter(symbol) if callable(getter) else None
        return str(token) if token is not None else None

    @staticmethod
    def _format_angel_datetime(value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(IST).strftime("%Y-%m-%d %H:%M")
