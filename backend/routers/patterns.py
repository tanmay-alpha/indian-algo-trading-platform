# backend/routers/patterns.py

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from backend.candles.candle_store import CandleStore
from backend.indicators.candle_patterns import detect_patterns
from backend.gateway.instrument_registry import get_instrument

router = APIRouter(prefix="/patterns", tags=["patterns"])


def _normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper()


def _validate_timeframe(timeframe: str) -> None:
    if timeframe not in CandleStore.MAX_CANDLES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe")


@router.get("/{symbol}")
async def get_patterns(
    symbol: str,
    request: Request,
    timeframe: str = "1m",
    limit: Optional[int] = None,
):
    _validate_timeframe(timeframe)
    normalized_symbol = _normalize_symbol(symbol)

    if not get_instrument(normalized_symbol):
        raise HTTPException(status_code=404, detail="Unknown symbol")

    store = getattr(request.app.state, "candle_store", None)
    if store is None:
        store = CandleStore()
        request.app.state.candle_store = store

    candles = store.get_candles(normalized_symbol, timeframe, limit=limit)
    if not candles:
        return {
            "symbol": normalized_symbol,
            "timeframe": timeframe,
            "available": False,
            "reason": "NO_CANDLES",
            "markers": [],
            "count": 0,
        }

    markers = detect_patterns(candles)
    return {
        "symbol": normalized_symbol,
        "timeframe": timeframe,
        "available": True,
        "markers": markers,
        "count": len(markers),
    }
