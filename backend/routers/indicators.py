from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.candles.candle_store import CandleStore
from backend.core.json_utils import json_safe
from backend.indicators.engine import IndicatorEngine
from backend.indicators.python_fallback import INDICATORS


router = APIRouter(prefix="/indicators", tags=["indicators"])

MAX_INPUT_LENGTH = 5000
SUPPORTED_INDICATORS = set(INDICATORS)
ALIASES = {
    "bb": "bollinger_bands",
    "bollinger": "bollinger_bands",
    "bollingerbands": "bollinger_bands",
}


class IndicatorCalculateRequest(BaseModel):
    close: Optional[list[float]] = None
    candles: Optional[list[dict[str, float]]] = None
    indicators: list[str] = Field(default_factory=list)
    params: dict[str, Any] = Field(default_factory=dict)


@router.get("/status")
def indicator_status(request: Request):
    engine = _get_engine(request)
    return {"available": True, **engine.status()}


@router.get("/{symbol}")
def get_indicators_for_symbol(
    symbol: str,
    request: Request,
    timeframe: str = "1m",
    names: str = "ema,rsi,macd",
    sma_period: int = 20,
    ema_period: int = 20,
    rsi_period: int = 14,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    atr_period: int = 14,
    bb_period: int = 20,
    bb_stddev: float = 2.0,
    limit: int = Query(default=300, ge=1, le=MAX_INPUT_LENGTH),
):
    _validate_timeframe(timeframe)
    requested = _parse_indicator_names(names.split(","))
    params = _params(
        sma_period,
        ema_period,
        rsi_period,
        macd_fast,
        macd_slow,
        macd_signal,
        atr_period,
        bb_period,
        bb_stddev,
    )
    _validate_params(params)

    engine = _get_engine(request)
    normalized_symbol = _normalize_symbol(symbol)
    candles = _get_store(request).get_candles(normalized_symbol, timeframe, limit=limit)
    if not candles:
        return {
            "symbol": normalized_symbol,
            "timeframe": timeframe,
            "engine": engine.selected_engine,
            "available": False,
            "reason": "NO_CANDLES",
            "results": {},
            "count": 0,
        }

    clean_candles = [_candle_for_indicator(candle) for candle in candles]
    close = [candle["close"] for candle in clean_candles]
    result = engine.calculate(close=close, candles=clean_candles, indicators=requested, params=params)
    return json_safe({
        "symbol": normalized_symbol,
        "timeframe": timeframe,
        "engine": result["engine"],
        "available": True,
        "count": len(clean_candles),
        "results": result["results"],
    })


@router.post("/calculate")
def calculate_indicators(payload: IndicatorCalculateRequest, request: Request):
    requested = _parse_indicator_names(payload.indicators)
    _validate_input_lengths(payload.close, payload.candles)
    params = dict(payload.params or {})
    _validate_params(params)

    clean_candles = None
    if payload.candles is not None:
        clean_candles = [_candle_for_indicator(candle) for candle in payload.candles]

    engine = _get_engine(request)
    result = engine.calculate(
        close=payload.close,
        candles=clean_candles,
        indicators=requested,
        params=params,
    )
    return json_safe({
        "engine": result["engine"],
        "available": True,
        "count": max(len(payload.close or []), len(clean_candles or [])),
        "results": result["results"],
    })


def _get_engine(request: Request) -> IndicatorEngine:
    engine = getattr(request.app.state, "indicator_engine", None)
    if engine is None:
        engine = IndicatorEngine()
        request.app.state.indicator_engine = engine
    return engine


def _get_store(request: Request) -> CandleStore:
    store = getattr(request.app.state, "candle_store", None)
    if store is None:
        store = CandleStore()
        request.app.state.candle_store = store
    return store


def _parse_indicator_names(raw_names: list[str]) -> list[str]:
    requested = []
    for raw_name in raw_names:
        name = ALIASES.get(str(raw_name or "").strip().lower(), str(raw_name or "").strip().lower())
        if not name:
            continue
        if name not in SUPPORTED_INDICATORS:
            raise HTTPException(status_code=400, detail=f"Unsupported indicator: {name}")
        requested.append(name)
    if not requested:
        raise HTTPException(status_code=400, detail="At least one indicator is required")
    return requested


def _params(
    sma_period: int,
    ema_period: int,
    rsi_period: int,
    macd_fast: int,
    macd_slow: int,
    macd_signal: int,
    atr_period: int,
    bb_period: int,
    bb_stddev: float,
) -> dict[str, Any]:
    return {
        "sma_period": sma_period,
        "ema_period": ema_period,
        "rsi_period": rsi_period,
        "macd_fast": macd_fast,
        "macd_slow": macd_slow,
        "macd_signal": macd_signal,
        "atr_period": atr_period,
        "bb_period": bb_period,
        "bb_stddev": bb_stddev,
    }


def _validate_params(params: dict[str, Any]) -> None:
    integer_params = (
        "sma_period",
        "ema_period",
        "rsi_period",
        "macd_fast",
        "macd_slow",
        "macd_signal",
        "atr_period",
        "bb_period",
    )
    parsed_ints: dict[str, int] = {}
    try:
        for key in integer_params:
            if key in params:
                parsed_ints[key] = int(params[key])
                if parsed_ints[key] <= 0:
                    raise HTTPException(status_code=400, detail=f"Invalid parameter: {key}")
        if "bb_stddev" in params and float(params["bb_stddev"]) <= 0:
            raise HTTPException(status_code=400, detail="Invalid parameter: bb_stddev")
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid indicator parameter type") from exc

    if "macd_fast" in parsed_ints and "macd_slow" in parsed_ints and parsed_ints["macd_fast"] >= parsed_ints["macd_slow"]:
        raise HTTPException(status_code=400, detail="Invalid MACD periods")


def _validate_input_lengths(close: Optional[list[float]], candles: Optional[list[dict[str, float]]]) -> None:
    if close is not None and len(close) > MAX_INPUT_LENGTH:
        raise HTTPException(status_code=400, detail="close input too large")
    if candles is not None and len(candles) > MAX_INPUT_LENGTH:
        raise HTTPException(status_code=400, detail="candle input too large")


def _validate_timeframe(timeframe: str) -> None:
    if timeframe not in CandleStore.MAX_CANDLES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe")


def _normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper()


def _candle_for_indicator(candle: dict[str, Any]) -> dict[str, Any]:
    try:
        res = {
            "open": float(candle["open"]),
            "high": float(candle["high"]),
            "low": float(candle["low"]),
            "close": float(candle["close"]),
            "volume": float(candle.get("volume") or 0),
        }
        if "time" in candle:
            res["time"] = int(candle["time"])
        return res
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Malformed candle input") from exc
