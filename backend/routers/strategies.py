from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError

from backend.candles.candle_store import CandleStore
from backend.core.json_utils import json_safe
from backend.core.rate_limit import limiter
from backend.core.security import require_admin_token
from backend.indicators.engine import IndicatorEngine
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.models import StrategyConfig
from backend.strategy.templates import get_strategy_templates


router = APIRouter(prefix="/strategies", tags=["strategies"])


class StrategyBacktestRequest(BaseModel):
    strategy_name: str
    symbol: str
    timeframe: str = "1m"
    params: dict[str, Any] = Field(default_factory=dict)
    initial_capital: float = 100000.0
    quantity: int = 1
    fee_bps: float = 3.0
    slippage_bps: float = 2.0
    candles: Optional[list[dict[str, Any]]] = None


class StrategySignalPreviewRequest(BaseModel):
    strategy_name: str
    symbol: str
    timeframe: str = "1m"
    params: dict[str, Any] = Field(default_factory=dict)
    candles: Optional[list[dict[str, Any]]] = None


@router.get("/status")
def strategy_status():
    templates = get_strategy_templates()
    return {
        "available": True,
        "engine": "python",
        "live_execution_enabled": False,
        "templates_count": len(templates),
        "supported_strategies": [template["strategy_name"] for template in templates],
        "backtesting_enabled": True,
    }


@router.get("/templates")
def strategy_templates():
    return {"templates": get_strategy_templates()}


@router.post("/backtest", dependencies=[Depends(require_admin_token)])
@limiter.limit("10/minute")
def run_backtest(payload: StrategyBacktestRequest, request: Request):
    config = _strategy_config(payload)
    candles = _request_candles(payload.candles, config.symbol, config.timeframe, request)
    engine = _get_backtest_engine(request)
    try:
        result = engine.run_backtest(config, candles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid backtest request") from exc  # SECURITY: redacted
    _record_backtest_history(request, config, result)
    return json_safe(_dump_model(result))


@router.post("/signal-preview", dependencies=[Depends(require_admin_token)])
@limiter.limit("20/minute")
def signal_preview(payload: StrategySignalPreviewRequest, request: Request):
    config = _strategy_config(payload)
    candles = _request_candles(payload.candles, config.symbol, config.timeframe, request)
    engine = _get_backtest_engine(request)
    try:
        signals = engine.generate_signals(config, candles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid signal preview request") from exc  # SECURITY: redacted
    return json_safe({
        "strategy_name": config.strategy_name,
        "symbol": config.symbol.strip().upper(),
        "timeframe": config.timeframe,
        "signals": [_dump_model(signal) for signal in signals],
        "count": len(signals),
    })


def _strategy_config(payload: StrategyBacktestRequest | StrategySignalPreviewRequest) -> StrategyConfig:
    try:
        return StrategyConfig(
            strategy_name=payload.strategy_name,
            symbol=payload.symbol,
            timeframe=payload.timeframe,
            params=payload.params or {},
            initial_capital=getattr(payload, "initial_capital", 100000.0),
            quantity=getattr(payload, "quantity", 1),
            fee_bps=getattr(payload, "fee_bps", 3.0),
            slippage_bps=getattr(payload, "slippage_bps", 2.0),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid strategy configuration") from exc


def _request_candles(
    posted_candles: Optional[list[dict[str, Any]]],
    symbol: str,
    timeframe: str,
    request: Request,
) -> list[dict[str, Any]]:
    if posted_candles is not None:
        return posted_candles
    store = _get_store(request)
    try:
        return store.get_candles(symbol.strip().upper(), timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Unsupported timeframe") from exc


def _get_backtest_engine(request: Request) -> BacktestEngine:
    engine = getattr(request.app.state, "backtest_engine", None)
    if engine is None:
        indicator_engine = getattr(request.app.state, "indicator_engine", None)
        if indicator_engine is None:
            indicator_engine = IndicatorEngine()
            request.app.state.indicator_engine = indicator_engine
        engine = BacktestEngine(indicator_engine=indicator_engine)
        request.app.state.backtest_engine = engine
    return engine


def _get_store(request: Request) -> CandleStore:
    store = getattr(request.app.state, "candle_store", None)
    if store is None:
        store = CandleStore()
        request.app.state.candle_store = store
    return store


def _dump_model(value):
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, list):
        return [_dump_model(item) for item in value]
    if isinstance(value, dict):
        return {key: _dump_model(item) for key, item in value.items()}
    return value


def _record_backtest_history(request: Request, config: StrategyConfig, result) -> None:
    history = getattr(request.app.state, "backtest_history", None)
    if history is None:
        history = deque(maxlen=50)
        request.app.state.backtest_history = history
    elif isinstance(history, list):
        history = deque(history[-50:], maxlen=50)
        request.app.state.backtest_history = history

    metrics = _dump_model(getattr(result, "metrics", None))
    history.append({
        "strategy_name": config.strategy_name,
        "symbol": config.symbol.strip().upper(),
        "timeframe": config.timeframe,
        "params": dict(config.params or {}),
        "metrics": metrics if isinstance(metrics, dict) else {},
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    })
