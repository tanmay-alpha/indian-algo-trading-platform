import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError, field_validator

from backend.candles.candle_store import CandleStore
from backend.core.json_utils import json_safe
from backend.core.rate_limit import limiter
from backend.core.security import require_admin_token, sanitize_response
from backend.indicators.engine import IndicatorEngine
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.models import StrategyConfig
from backend.strategy.templates import get_strategy_templates
from backend.core.database import create_engine_safe, get_session_factory, init_db_metadata
from backend.db.repositories.strategy_repository import StrategyRepository
from backend.gateway import instrument_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategies", tags=["strategies"])

_db_engine = None
_db_session_factory = None
_repo = StrategyRepository()


def _get_session():
    global _db_engine, _db_session_factory
    if _db_engine is None:
        _db_engine = create_engine_safe()
        init_db_metadata(_db_engine)
        _db_session_factory = get_session_factory(_db_engine)
    return _db_session_factory()


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


class CreateStrategyConfigRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    template_id: str = Field(..., min_length=1, max_length=100)
    symbols: list[str] = Field(..., min_length=1)
    timeframe: str = Field(default="1m")
    parameters: dict[str, Any] = Field(default_factory=dict)
    mode: str = Field(default="PAPER")


class UpdateStrategyConfigRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    symbols: Optional[list[str]] = Field(None, min_length=1)
    timeframe: Optional[str] = Field(None)
    parameters: Optional[dict[str, Any]] = Field(None)
    mode: Optional[str] = Field(None)


def _config_to_dict(config) -> dict:
    try:
        symbols_list = json.loads(config.symbols) if isinstance(config.symbols, str) else config.symbols
    except Exception:
        symbols_list = []
        
    try:
        params_dict = json.loads(config.parameters) if isinstance(config.parameters, str) else config.parameters
    except Exception:
        params_dict = {}

    return {
        "id": config.id,
        "name": config.name,
        "template_id": config.template_id,
        "symbols": symbols_list,
        "timeframe": config.timeframe,
        "parameters": params_dict,
        "status": config.status,
        "mode": config.mode,
        "created_at": config.created_at.isoformat() if hasattr(config.created_at, "isoformat") else config.created_at,
        "updated_at": config.updated_at.isoformat() if hasattr(config.updated_at, "isoformat") else config.updated_at,
    }


def _signal_to_dict(sig) -> dict:
    return {
        "id": sig.id,
        "strategy_id": sig.strategy_id,
        "symbol": sig.symbol,
        "side": sig.side,
        "confidence": sig.confidence,
        "reason": sig.reason,
        "price": sig.price,
        "timeframe": sig.timeframe,
        "source_candle_time": sig.source_candle_time,
        "status": sig.status,
        "created_at": sig.created_at.isoformat() if hasattr(sig.created_at, "isoformat") else sig.created_at,
    }


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
        raise HTTPException(status_code=400, detail="Invalid backtest request") from exc
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
        raise HTTPException(status_code=400, detail="Invalid signal preview request") from exc
    return json_safe({
        "strategy_name": config.strategy_name,
        "symbol": config.symbol.strip().upper(),
        "timeframe": config.timeframe,
        "signals": [_dump_model(signal) for signal in signals],
        "count": len(signals),
    })


# ------------------------------------------------------------------
# Strategy Configuration & Signal CRUD / Actions
# ------------------------------------------------------------------

@router.get("/configs")
def get_strategy_configs():
    session = None
    try:
        session = _get_session()
        configs = _repo.get_all_strategy_configs(session)
        return sanitize_response([_config_to_dict(c) for c in configs])
    except Exception as exc:
        logger.error("Error retrieving strategy configurations: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve strategy configurations")
    finally:
        if session:
            session.close()


def normalize_template_id(template_id: str) -> str:
    normalized = template_id.lower().strip()
    if normalized in ("ema_cross", "ema_crossover"):
        return "EMA_CROSSOVER"
    if normalized in ("rsi_mean_reversion", "rsi"):
        return "RSI_MEAN_REVERSION"
    if normalized in ("macd_trend", "macd"):
        return "MACD_TREND"
    if normalized in ("vwap_pullback", "vwap"):
        return "VWAP_PULLBACK"
    if normalized in ("bollinger_breakout", "bollinger", "bb_breakout"):
        return "BOLLINGER_BREAKOUT"
    return template_id.upper()


def _validate_config_data(
    template_id: Optional[str],
    timeframe: Optional[str],
    parameters: Optional[dict[str, Any]],
    mode: Optional[str],
):
    if template_id is not None:
        supported = [t["strategy_name"] for t in get_strategy_templates()]
        norm_template = normalize_template_id(template_id)
        if norm_template not in supported:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported strategy template: {template_id}"
            )

    if timeframe is not None:
        if timeframe not in ["1m", "5m", "15m", "1h", "1d"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid timeframe"
            )

    if mode is not None:
        if mode not in ["PAPER", "REVIEW_ONLY"]:
            raise HTTPException(
                status_code=400,
                detail="Unsupported mode"
            )

    if parameters is not None:
        if template_id is not None:
            norm_template = normalize_template_id(template_id)
            if norm_template == "EMA_CROSSOVER":
                fast_ema = parameters.get("fast_ema")
                if fast_ema is None:
                    fast_ema = parameters.get("fast_period")
                slow_ema = parameters.get("slow_ema")
                if slow_ema is None:
                    slow_ema = parameters.get("slow_period")
                
                if fast_ema is not None:
                    try:
                        if isinstance(fast_ema, bool):
                            raise ValueError()
                        fast_ema_val = int(fast_ema)
                        if fast_ema_val <= 0:
                            raise ValueError()
                    except (ValueError, TypeError):
                        raise HTTPException(status_code=400, detail="validation error: fast_ema/fast_period must be positive integer")
                if slow_ema is not None:
                    try:
                        if isinstance(slow_ema, bool):
                            raise ValueError()
                        slow_ema_val = int(slow_ema)
                        if slow_ema_val <= 0:
                            raise ValueError()
                    except (ValueError, TypeError):
                        raise HTTPException(status_code=400, detail="validation error: slow_ema/slow_period must be positive integer")


@router.post("/configs", dependencies=[Depends(require_admin_token)])
def create_strategy_config(payload: CreateStrategyConfigRequest):
    _validate_config_data(payload.template_id, payload.timeframe, payload.parameters, payload.mode)
    
    # Validate symbol existence in instrument registry
    for symbol in payload.symbols:
        clean_symbol = symbol.strip().upper()
        if not instrument_registry.get_instrument(clean_symbol):
            raise HTTPException(
                status_code=400,
                detail=f"Symbol '{symbol}' not found in instrument registry"
            )

    session = None
    try:
        session = _get_session()
        # Store template_id as normalized template name
        config = _repo.create_strategy_config(
            session=session,
            name=payload.name.strip(),
            template_id=normalize_template_id(payload.template_id),
            symbols=[s.strip().upper() for s in payload.symbols],
            timeframe=payload.timeframe,
            parameters=payload.parameters,
            mode=payload.mode,
        )
        return sanitize_response(_config_to_dict(config))
    except Exception as exc:
        logger.error("Error creating strategy configuration: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create strategy configuration")
    finally:
        if session:
            session.close()


@router.get("/configs/{id}")
def get_strategy_config(id: int):
    session = None
    try:
        session = _get_session()
        config = _repo.get_strategy_config(session, id)
        if not config:
            raise HTTPException(status_code=404, detail="Strategy configuration not found")
        return sanitize_response(_config_to_dict(config))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error retrieving strategy configuration: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve strategy configuration")
    finally:
        if session:
            session.close()


@router.patch("/configs/{id}", dependencies=[Depends(require_admin_token)])
def update_strategy_config(id: int, payload: UpdateStrategyConfigRequest):
    # PATCH has no template_id field; pass None so template validation is skipped
    _validate_config_data(None, payload.timeframe, payload.parameters, payload.mode)

    if payload.symbols is not None:
        for symbol in payload.symbols:
            clean_symbol = symbol.strip().upper()
            if not instrument_registry.get_instrument(clean_symbol):
                raise HTTPException(
                    status_code=400,
                    detail=f"Symbol '{symbol}' not found in instrument registry"
                )

    session = None
    try:
        session = _get_session()
        # Filter None values to only update sent fields
        update_data = payload.model_dump(exclude_unset=True)
        if "symbols" in update_data and update_data["symbols"] is not None:
            update_data["symbols"] = [s.strip().upper() for s in update_data["symbols"]]

        config = _repo.update_strategy_config(session, id, **update_data)
        if not config:
            raise HTTPException(status_code=404, detail="Strategy configuration not found")
        return sanitize_response(_config_to_dict(config))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error updating strategy configuration: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update strategy configuration")
    finally:
        if session:
            session.close()


@router.delete("/configs/{id}", dependencies=[Depends(require_admin_token)])
async def delete_strategy_config(id: int, request: Request):
    # First, make sure the strategy is stopped in runtime manager
    runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    if runtime:
        try:
            runtime.stop_strategy(id)
        except Exception as exc:
            logger.warning("Failed to stop strategy %d in runtime on deletion: %s", id, exc)

    session = None
    try:
        session = _get_session()
        success = _repo.delete_strategy_config(session, id)
        if not success:
            raise HTTPException(status_code=404, detail="Strategy configuration not found")
        return sanitize_response({"status": "success", "id": id})
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error deleting strategy configuration: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete strategy configuration")
    finally:
        if session:
            session.close()


@router.post("/configs/{id}/start", dependencies=[Depends(require_admin_token)])
async def start_strategy(id: int, request: Request):
    runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    if not runtime:
        raise HTTPException(status_code=500, detail="Strategy runtime not initialized")
    try:
        runtime.start_strategy(id)
        return sanitize_response({"status": "RUNNING", "id": id})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error starting strategy %d: %s", id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to start strategy: {exc}")


@router.post("/configs/{id}/stop", dependencies=[Depends(require_admin_token)])
async def stop_strategy(id: int, request: Request):
    runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    if not runtime:
        raise HTTPException(status_code=500, detail="Strategy runtime not initialized")
    try:
        runtime.stop_strategy(id)
        return sanitize_response({"status": "STOPPED", "id": id})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error stopping strategy %d: %s", id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to stop strategy: {exc}")


@router.post("/configs/{id}/pause", dependencies=[Depends(require_admin_token)])
async def pause_strategy(id: int, request: Request):
    runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    if not runtime:
        raise HTTPException(status_code=500, detail="Strategy runtime not initialized")
    try:
        runtime.pause_strategy(id)
        return sanitize_response({"status": "PAUSED", "id": id})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error pausing strategy %d: %s", id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to pause strategy: {exc}")


@router.post("/configs/{id}/evaluate", dependencies=[Depends(require_admin_token)])
async def evaluate_strategy(id: int, request: Request):
    runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    if not runtime:
        raise HTTPException(status_code=500, detail="Strategy runtime not initialized")
    try:
        await runtime.evaluate_strategy(id)
        return sanitize_response({"status": "success", "evaluation_triggered": True})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error evaluating strategy %d: %s", id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to evaluate strategy: {exc}")


@router.get("/configs/{id}/signals")
def get_strategy_signals(id: int):
    session = None
    try:
        session = _get_session()
        # Verify configuration exists
        config = _repo.get_strategy_config(session, id)
        if not config:
            raise HTTPException(status_code=404, detail="Strategy configuration not found")
        signals = _repo.get_signals_for_strategy(session, id)
        return sanitize_response([_signal_to_dict(s) for s in signals])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error retrieving strategy signals: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve strategy signals")
    finally:
        if session:
            session.close()


@router.get("/signals")
def get_all_recorded_signals():
    session = None
    try:
        session = _get_session()
        signals = _repo.get_all_signals(session)
        return sanitize_response([_signal_to_dict(s) for s in signals])
    except Exception as exc:
        logger.error("Error retrieving all strategy signals: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve all strategy signals")
    finally:
        if session:
            session.close()


@router.post("/signals/{signal_id}/approve-paper", dependencies=[Depends(require_admin_token)])
async def approve_strategy_signal(signal_id: int, request: Request):
    runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    if not runtime:
        raise HTTPException(status_code=500, detail="Strategy runtime not initialized")
    try:
        success = await runtime.approve_signal(signal_id)
        if not success:
            raise HTTPException(status_code=404, detail="Signal not found or could not be approved")
        
        # Query DB to get the approved signal
        session = _get_session()
        try:
            from backend.db.models import StrategySignalModel
            signal = session.query(StrategySignalModel).filter(StrategySignalModel.id == signal_id).first()
            if not signal:
                raise HTTPException(status_code=404, detail="Signal not found")
            return sanitize_response(_signal_to_dict(signal))
        finally:
            session.close()
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error approving signal %d: %s", signal_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to approve signal: {exc}")


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

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
