from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.candles.candle_store import CandleStore
from backend.gateway.instrument_registry import get_instrument


router = APIRouter(prefix="/candles", tags=["candles"])


class CandleFetchRequest(BaseModel):
    timeframe: str = "1m"
    from_dt: Optional[str] = None
    to_dt: Optional[str] = None


@router.get("/status")
def candle_status(request: Request):
    store = _get_store(request)
    status = store.stats()
    status["supported_timeframes"] = list(CandleStore.MAX_CANDLES.keys())
    return status


@router.get("/{symbol}")
async def get_candles(
    symbol: str,
    request: Request,
    timeframe: str = "1m",
    limit: Optional[int] = None,
    fetch: bool = False,
):
    _validate_timeframe(timeframe)
    normalized_symbol = _normalize_symbol(symbol)
    if not get_instrument(normalized_symbol):
        raise HTTPException(status_code=404, detail="Unknown symbol")

    store = _get_store(request)
    fetch_result = None
    if fetch:
        fetcher = getattr(request.app.state, "candle_fetcher", None)
        if fetcher:
            fetch_result = await fetcher.fetch_and_load(normalized_symbol, timeframe)
        else:
            fetch_result = {"symbol": normalized_symbol, "timeframe": timeframe, "error": "candle_fetcher_unavailable"}

    candles = store.get_candles(normalized_symbol, timeframe, limit=limit)
    source = "cache" if candles else "empty"
    if fetch and candles:
        source = "fetched"

    return {
        "symbol": normalized_symbol,
        "timeframe": timeframe,
        "candles": candles,
        "count": len(candles),
        "has_live_candle": bool(candles and candles[-1].get("is_live")),
        "source": source,
        "fetch_result": fetch_result,
        "warning": None,
    }


@router.post("/{symbol}/fetch")
async def fetch_candles(symbol: str, payload: CandleFetchRequest, request: Request):
    _validate_timeframe(payload.timeframe)
    normalized_symbol = _normalize_symbol(symbol)
    if not get_instrument(normalized_symbol):
        raise HTTPException(status_code=404, detail="Unknown symbol")

    session_manager = getattr(request.app.state, "session_manager", None)
    if not session_manager or not getattr(session_manager, "is_valid", False):
        raise HTTPException(status_code=503, detail="Broker session not available")

    fetcher = getattr(request.app.state, "candle_fetcher", None)
    if fetcher is None:
        raise HTTPException(status_code=503, detail="Candle fetcher not available")

    return await fetcher.fetch_and_load(
        normalized_symbol,
        payload.timeframe,
        _parse_optional_datetime(payload.from_dt),
        _parse_optional_datetime(payload.to_dt),
    )


def _get_store(request: Request) -> CandleStore:
    store = getattr(request.app.state, "candle_store", None)
    if store is None:
        store = CandleStore()
        request.app.state.candle_store = store
    return store


def _validate_timeframe(timeframe: str) -> None:
    if timeframe not in CandleStore.MAX_CANDLES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe")


def _normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper()


def _parse_optional_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
