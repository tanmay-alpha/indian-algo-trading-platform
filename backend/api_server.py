# backend/api_server.py

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response
from pydantic import BaseModel
import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from backend.candles.candle_store import CandleStore
from backend.core.config import settings
from backend.core.event_bus import EventBus
from backend.core.rate_limit import limiter, register_rate_limiter
from backend.core.security import require_admin_token, sanitize_response
from backend.routers import candles as candles_router
from backend.routers import indicators as indicators_router
from backend.routers import portfolio as portfolio_router
from backend.routers import strategies as strategies_router
from backend.routers import discovery as discovery_router
from backend.routers import observability as observability_router
from backend.routers import oms as oms_router
from backend.routers import watchlists as watchlists_router
from backend.routers import patterns as patterns_router
from backend.routers import broker_account as broker_account_router
from backend.routers import trade_reconciliation as trade_reconciliation_router
from backend.routers import account_reconciliation as account_reconciliation_router
from backend.routers import auth as auth_router
from backend.routers import live_approval_sandbox as live_approval_sandbox_router
from backend.routers import safety as safety_router
from backend.routers import manual_order as manual_order_router
from backend.routers import live_execution as live_execution_router
from backend.services.watchlist_service import WatchlistService
from backend.indicators.engine import IndicatorEngine
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.templates import get_strategy_templates
from backend.discovery.market_board import MarketBoard
from backend.discovery.screener_engine import ScreenerEngine
from backend.gateway import instrument_registry
from backend.gateway.instrument_loader import InstrumentLoader
from backend.gateway.market_watch import MarketWatch
from backend.gateway.instrument_registry import search_symbols, get_instrument
from backend.execution.execution_router import ExecutionRouter
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.engine.strategy_engine import StrategyEngine
from backend.core.broadcaster import WebSocketBroadcaster
from backend.observability.metrics_store import MetricsStore
from backend.observability.event_log import ObservabilityEventLog
from backend.observability.health_timeline import HealthTimeline
from backend.core.orchestrator import SystemOrchestrator

# --- Global Logger ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def safe_error_message(error):
    # Delegated to the orchestrator's implementation to keep a single source of truth.
    from backend.core.orchestrator import safe_error_message as _orchestrator_safe_error_message
    return _orchestrator_safe_error_message(error)

@asynccontextmanager
async def lifespan(_: FastAPI):
    await startup_event()
    try:
        yield
    finally:
        await shutdown_event()


app = FastAPI(
    title="MAET Terminal API",
    description="Paper-mode market research, portfolio, chart, and dry-run validation API.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)
register_rate_limiter(app)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: StarletteRequest, call_next):
        response: Response = await call_next(request)
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Referrer policy for privacy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Content Security Policy (restrictive, allow self + Vercel)
        csp_origin = settings.public_backend_url or "*"
        response.headers["Content-Security-Policy"] = (
            f"default-src 'self'; "
            f"connect-src 'self' https://*.vercel.app {csp_origin}; "
            f"script-src 'self' 'unsafe-inline'; "
            f"style-src 'self' 'unsafe-inline'; "
            f"img-src 'self' data: https:; "
            f"frame-ancestors 'none'"
        )
        return response


# Methods that mutate state and need CSRF / Origin protection
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class CSRFGuardMiddleware(BaseHTTPMiddleware):
    """Reject state-changing requests that come from an untrusted Origin.

    Browsers automatically attach cookies on cross-origin requests, so even
    a Bearer-token API should reject state-changing requests from origins
    outside its allowlist. This is a defense-in-depth measure on top of
    the standard `Authorization: Bearer ...` pattern.

    The check passes if:
      - The Origin header matches the CORS allowlist, OR
      - The request is not a state-changing method, OR
      - No Origin header is present (e.g., direct API call from a tool)
    """

    async def dispatch(self, request: StarletteRequest, call_next):
        if request.method.upper() in _UNSAFE_METHODS:
            origin = request.headers.get("origin", "")
            if origin:  # Browsers always send Origin on POST/PUT/PATCH/DELETE
                allowed = get_cors_origins()
                if allowed and origin not in allowed:
                    return Response(
                        content='{"detail": "CSRF: untrusted origin"}',
                        status_code=403,
                        media_type="application/json",
                    )
        return await call_next(request)

def get_cors_origins() -> list[str]:
    required_origins = [
        "https://indian-algo-trading-platform.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ]
    origins = [*required_origins, *(settings.allowed_origin_list or [])]
    origins = list(dict.fromkeys(origins))
    if settings.environment.upper() == "PRODUCTION":
        origins = [origin for origin in origins if origin != "*"]
    return origins


# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Security headers (must be added AFTER CORSMiddleware so it doesn't override CORS)
app.add_middleware(SecurityHeadersMiddleware)
# CSRF protection — reject state-changing requests from untrusted origins
app.add_middleware(CSRFGuardMiddleware)
app.include_router(candles_router.router)
app.include_router(indicators_router.router)
app.include_router(portfolio_router.router)
app.include_router(strategies_router.router)
app.include_router(discovery_router.router)
app.include_router(observability_router.router)
app.include_router(observability_router.prometheus_router)
app.include_router(oms_router.router)
app.include_router(watchlists_router.router)
app.include_router(patterns_router.router)
app.include_router(broker_account_router.router)
app.include_router(trade_reconciliation_router.router)
app.include_router(account_reconciliation_router.router)
app.include_router(auth_router.router)
app.include_router(live_approval_sandbox_router.router)
app.include_router(safety_router.router)
app.include_router(manual_order_router.router)
app.include_router(live_execution_router.router)

# --- Components ---
broadcaster = WebSocketBroadcaster()
gateway = None
tick_bus = None
session_manager = None
tick_consumer_task = None
sampler_task = None
event_bus = EventBus()
candle_store = CandleStore()
indicator_engine = IndicatorEngine()
backtest_engine = BacktestEngine(indicator_engine=indicator_engine)
candle_fetcher = None
market_watch = MarketWatch(default_symbols=settings.symbols)
class DummyRiskManager:
    def open_position(self, symbol, side, quantity, price):
        pass

class CompatiblePortfolioEngine(PortfolioEngine):
    def open_position(self, symbol, side, quantity, entry_price):
        pass

    def update_unrealized(self, symbol, price):
        if price is not None:
            self.positions.update_unrealized(symbol, price)

    def get_performance(self):
        summary = self.get_summary()
        return {
            "initial_capital": self.initial_capital,
            "current_capital": summary["equity"],
            "realized_pnl": summary["realized_pnl"],
            "unrealized_pnl": summary["unrealized_pnl"],
            "total_trades": len(self.positions.fill_history),
            "win_rate": 0.0,
            "max_drawdown": summary["max_drawdown"],
        }

    @property
    def daily_pnl(self) -> float:
        return self.get_summary().get("net_pnl", 0.0)

    @property
    def current_daily_pnl(self) -> float:
        return self.get_summary().get("net_pnl", 0.0)

    @property
    def realized_pnl(self) -> float:
        return self.get_summary().get("realized_pnl", 0.0)

    @property
    def open_positions(self) -> list[dict]:
        return self.get_positions()

strategy = StrategyEngine()

auto_pilot = False
last_trade_time = 0.0
trade_cooldown = 60.0

execution_mode = "PAPER"
portfolio_engine = CompatiblePortfolioEngine(initial_capital=50000, event_bus=event_bus, trading_mode=execution_mode)
portfolio = portfolio_engine
risk = DummyRiskManager()

router = ExecutionRouter(
    mode=execution_mode,
    event_bus=event_bus,
    market_watch=market_watch,
    portfolio_manager=portfolio,
    risk_manager=risk,
    live_enabled=settings.live_trading_enabled,
)

broker_status = {
    "configured": True,
    "logged_in": False,
    "feed_token_available": False,
    "websocket_started": False,
    "last_error": None,
}
instrument_master_status = {
    "loaded": 0,
    "source": "fallback",
    "cached_at": None,
    "cache_fresh": False,
    "fallback_active": True,
}


def _ensure_instrument_master_loaded() -> None:
    """Lazily load the instrument master on first access (e.g. /health, /ready).

    The first request that touches the instrument count pays the parse cost;
    subsequent requests hit the in-memory cache. This shaves seconds off the
    cold-start path that the keep-alive /ping would otherwise block on.
    """
    if instrument_master_status["loaded"] > 0:
        return
    try:
        instrument_master_status["loaded"] = len(instrument_registry.load_instruments())
    except Exception as e:
        logger.warning("Deferred instrument master load failed: %s", e.__class__.__name__)
instrument_loader = InstrumentLoader(timeout_seconds=12)
market_board = MarketBoard(market_watch)
screener_engine = ScreenerEngine(indicator_engine, candle_store, market_watch)
obs_metrics = MetricsStore()
obs_event_log = ObservabilityEventLog()
obs_timeline = HealthTimeline()

# Create SystemOrchestrator to encapsulate lifecycle/loops

def sync_orchestrator_state(name: str, value):
    """Callback to synchronize orchestrator internal states back to module globals & app state."""
    globals()[name] = value
    if hasattr(app, "state"):
        setattr(app.state, name, value)

orchestrator = SystemOrchestrator(
    broadcaster=broadcaster,
    event_bus=event_bus,
    candle_store=candle_store,
    indicator_engine=indicator_engine,
    backtest_engine=backtest_engine,
    market_watch=market_watch,
    portfolio=portfolio,
    risk=risk,
    strategy=strategy,
    portfolio_engine=portfolio_engine,
    router=router,
    instrument_loader=instrument_loader,
    market_board=market_board,
    screener_engine=screener_engine,
    obs_metrics=obs_metrics,
    obs_event_log=obs_event_log,
    obs_timeline=obs_timeline,
    execution_mode=execution_mode,
    on_state_update=sync_orchestrator_state,
    get_auto_pilot=lambda: auto_pilot,
    get_trade_cooldown=lambda: trade_cooldown,
    get_last_trade_time=lambda: last_trade_time,
    get_execution_mode=lambda: execution_mode,
)

# Export validation variables that are required by tests or external routes
signal_validator = orchestrator.signal_validator
auto_pilot = orchestrator.auto_pilot
last_trade_time = orchestrator.last_trade_time
trade_cooldown = orchestrator.trade_cooldown

class MarketWatchRequest(BaseModel):
    symbols: list[str]


class WsSubscribeRequest(BaseModel):
    """Body for /ws/subscribe. The frontend calls this whenever the user adds or
    removes a symbol from their watchlist, so the broker gateway's live
    subscription set matches the UI without a full reconnect."""

    symbols: list[str]
    add: bool = True


app.state.broadcaster = broadcaster
app.state.gateway = gateway
app.state.tick_bus = tick_bus
app.state.event_bus = event_bus
app.state.candle_store = candle_store
app.state.indicator_engine = indicator_engine
app.state.backtest_engine = backtest_engine
app.state.candle_fetcher = candle_fetcher
app.state.market_watch_state = market_watch
app.state.session_manager = session_manager
app.state.portfolio_engine = portfolio_engine
app.state.instrument_loader = instrument_loader
app.state.market_board = market_board
app.state.screener_engine = screener_engine
app.state.obs_metrics = obs_metrics
app.state.obs_event_log = obs_event_log
app.state.obs_timeline = obs_timeline
app.state.execution_router = router
app.state.backtest_history = []
app.state.orchestrator = orchestrator
app.state.strategy_runtime_manager = orchestrator.strategy_runtime_manager
app.state.strategy_scheduler = orchestrator.strategy_scheduler
# Phase 18J: OMS admin visibility state
app.state.order_store = getattr(router, "order_store", None)
app.state.trading_mode = execution_mode
app.state.oms_rebuild_summary = None  # populated after startup rebuild
app.state.oms_rebuild_at = None
app.state.last_reconciliation_report = None
app.state.last_reconciliation_at = None


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def parse_event_datetime(value) -> datetime:
    # Re-export from orchestrator to keep a single source of truth.
    from backend.core.orchestrator import parse_event_datetime as _parse_event_datetime
    return _parse_event_datetime(value)

async def websocket_broadcast(message: dict):
    await broadcaster.broadcast(message)

def websocket_route_paths() -> list[str]:
    return sorted(
        getattr(route, "path", "")
        for route in app.routes
        if getattr(route, "path", "").startswith("/ws/")
        and getattr(route, "methods", None) is None
    )

async def process_tick(tick: dict):
    """Processes a live market tick: Updates strategy, risk, and portfolio."""
    await orchestrator.process_tick(tick)

def get_broker_status():
    return orchestrator.get_broker_status()

async def start_gateway(loop):
    return await orchestrator.start_gateway(loop)

async def start_gateway_background(loop):
    await orchestrator.start_gateway_background(loop)

async def load_instrument_master_best_effort():
    await orchestrator.load_instrument_master_best_effort()

async def startup_event():
    """Initializes the backend services on startup."""
    logger.info("[startup] Starting initialization...")

    # Validate critical configuration BEFORE starting any service. Fail-fast on
    # empty JWT secrets, weak admin tokens, or missing production DB.
    from backend.core.config_validation import (
        validate_all_config,
        ConfigValidationError,
    )
    try:
        config_snapshot = {
            "jwt_secret_key": settings.jwt_secret_key,
            "jwt_access_token_expire_minutes": settings.jwt_access_token_expire_minutes,
            "max_order_qty": settings.max_order_qty,
            "max_order_notional": settings.max_order_notional,
            "trading_mode": settings.trading_mode,
            "environment": settings.environment,
            "database_url": settings.database_url,
            "db_path": settings.db_path,
            "admin_token": settings.admin_token,
            "allowed_origins": settings.allowed_origins,
            "live_trading_enabled": settings.live_trading_enabled,
            "angel_api_key": settings.angel_api_key,
            "angel_client_code": settings.angel_client_code,
            "angel_password": settings.angel_password,
            "angel_totp_secret": settings.angel_totp_secret,
            "symbols": settings.symbols,
        }
        validate_all_config(config_snapshot)
        logger.info("[startup] Configuration validation passed")
    except ConfigValidationError as e:
        logger.error("[startup] Refusing to start: %s", e)
        raise RuntimeError(f"Configuration validation failed: {e}") from e

    try:
        logger.info("[startup] Calling orchestrator.startup...")
        await orchestrator.startup(app.state)
        logger.info("[startup] All services started successfully")
    except Exception as e:
        logger.error("[startup] Orchestrator startup failed: %s (%s)", e, type(e).__name__)
        # In Render, any unhandled exception crashes the instance. We want to know what failed.
        import traceback
        logger.error(traceback.format_exc())
        raise  # Re-raise to make sure uvicorn sees the error

async def shutdown_event():
    await orchestrator.shutdown()

def check_database_status():
    from backend.core.security import _db_engine
    from backend.core.database import create_engine_safe, check_db_health, redact_db_url, get_database_url
    if settings.environment.upper() == "PRODUCTION" and (
        not settings.database_url or settings.inferred_database_backend != "postgres"
    ):
        return {
            "connected": False,
            "error": "Production requires PostgreSQL DATABASE_URL",
            "url": redact_db_url(settings.database_url or ""),
        }

    engine = _db_engine
    if engine is None:
        try:
            engine = create_engine_safe()
        except Exception as e:
            from backend.core.database import sanitize_db_error
            return {
                "connected": False,
                "error": sanitize_db_error(str(e), get_database_url()),
                "url": redact_db_url(get_database_url())
            }
    
    connected, err = check_db_health(engine)
    return {
        "connected": connected,
        "error": err,
        "url": redact_db_url(str(engine.url)) if engine else redact_db_url(get_database_url())
    }

@app.get("/")
@app.get("/health")
def health_check():
    """Public health check — returns only overall status, no internals.
    Use /admin/health (with admin auth) for detailed diagnostics.
    """
    db_status = check_database_status()
    return {
        "status": "online" if db_status["connected"] else "degraded",
    }


@app.get("/admin/health")
async def admin_health_check(
    x_admin_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Detailed health check with full diagnostics. Admin-only.
    Exposes DB URL, broker status, portfolio summary — all sanitized.
    """
    from backend.core.security import require_admin_token
    await require_admin_token(
        x_admin_token=x_admin_token,
        authorization=authorization,
    )
    db_status = check_database_status()
    return sanitize_response({
        "status": "online" if db_status["connected"] else "degraded",
        "mode": execution_mode,
        "database": {
            "connected": db_status["connected"],
            "url": db_status["url"],
            "error": db_status["error"]
        },
        "broker": get_broker_status(),
        "portfolio": portfolio_engine.get_summary(),
        "portfolio_engine": portfolio_engine.get_summary(),
    })

@app.get("/live")
def live_check():
    return {"status": "alive"}

@app.get("/ping")
async def ping():
    return {"status": "ok", "ts": time.time()}

@app.get("/ready")
def ready_check():
    db_path = Path(settings.db_path)
    db_parent = db_path.parent if db_path.parent != Path("") else Path(".")
    gateway_status = gateway.status() if gateway else None
    db_status = check_database_status()
    return sanitize_response({
        "status": "ready" if db_status["connected"] else "error",
        "app": {"status": "online", "environment": settings.environment},
        "broker": get_broker_status(),
        "gateway": gateway_status,
        "database": {
            "path_configured": bool(settings.db_path),
            "parent_exists": db_parent.exists(),
            "path": settings.db_path,
            "connected": db_status["connected"],
            "url": db_status["url"],
            "error": db_status["error"]
        },
        "trading_mode": execution_mode,
        "live_trading_enabled": settings.live_trading_enabled,
    })

@app.get("/frontend/bootstrap")
def frontend_bootstrap():
    """
    Expose app configuration, trading modes, safety locks, and active modules.
    This is read-only and public, helping the frontend configure its UI accordingly.
    """
    from backend.core.live_build_policy import is_live_execution_build_enabled
    
    bootstrap_data = {
        "app": {
            "name": "MAET Terminal",
            "version": "1.0.0",
            "environment": settings.environment,
            "status": "online"
        },
        "trading_mode": execution_mode,
        "demo_mode": settings.demo_mode,
        "safety_locks": {
            "live_trading_locked": not is_live_execution_build_enabled(),
            "live_execution_build_enabled": is_live_execution_build_enabled(),
            "live_approval_sandbox_enabled": settings.live_approval_sandbox_enabled,
            "broker_mutation_guard_active": True
        },
        "modules": [
            "auth",
            "broker_account",
            "candles",
            "discovery",
            "indicators",
            "live_execution",
            "manual_order",
            "observability",
            "oms",
            "patterns",
            "portfolio",
            "reconciliation",
            "safety",
            "strategies",
            "watchlists"
        ]
    }
    return sanitize_response(bootstrap_data)

@app.get("/instruments/search")
@limiter.limit("60/minute")
def search_instruments(request: Request, q: str = Query(default=""), limit: int = Query(default=20, ge=1, le=100)):
    return sanitize_response({
        "query": q,
        "results": search_symbols(q, limit=limit) if q else [],
    })

@app.get("/instruments/master/status")
def get_instrument_master_status():
    _ensure_instrument_master_loaded()
    return instrument_master_status.copy()

@app.get("/market-watch")
def get_market_watch():
    # Phase 19D: Try DB-backed watchlist first, fall back to in-memory.
    # Subscription boundary: only selected watchlist symbols are subscribed, not the full instrument universe.
    try:
        svc = WatchlistService(market_watch=market_watch)
        result = svc.get_market_watch_snapshot()
        if result.get("items"):
            return sanitize_response(result)
    except Exception as _exc:
        logger.debug("DB market-watch snapshot failed, using fallback: %s", _exc)
    return sanitize_response({
        "symbols": market_watch.symbols,
        "items": market_watch.snapshot(),
        "source": "fallback",
    })

@app.post("/market-watch", dependencies=[Depends(require_admin_token)])
async def update_market_watch(payload: MarketWatchRequest):
    valid, invalid = market_watch.set_symbols(payload.symbols)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Unknown symbols rejected", "invalid_symbols": invalid},
        )

    if gateway and gateway.connection_state in ["CONNECTING", "CONNECTED", "RECONNECTING"]:
        await gateway.update_subscriptions(valid)

    return sanitize_response({
        "status": "success",
        "symbols": valid,
        "items": market_watch.snapshot(),
    })

@app.delete("/market-watch/{symbol}", dependencies=[Depends(require_admin_token)])
async def delete_market_watch_symbol(symbol: str):
    normalized_symbol = str(symbol or "").strip().upper()
    candidates = {normalized_symbol}
    if normalized_symbol.endswith("-EQ"):
        candidates.add(normalized_symbol[:-3])
    remaining = [item for item in market_watch.symbols if item not in candidates]
    if len(remaining) == len(market_watch.symbols):
        raise HTTPException(status_code=404, detail="Symbol not in market watch")

    valid, invalid = market_watch.set_symbols(remaining)
    if invalid:
        raise HTTPException(status_code=400, detail="Market watch update failed")

    if gateway and gateway.connection_state in ["CONNECTING", "CONNECTED", "RECONNECTING"]:
        await gateway.update_subscriptions(valid)

    return sanitize_response({
        "status": "success",
        "symbols": valid,
        "items": market_watch.snapshot(),
    })

@app.get("/indices")
def get_indices():
    indices = []
    # Use latest market_watch tick data when available so the index strip
    # actually shows movement once ticks start flowing.
    mw_latest = market_watch.latest_ticks or {}
    for symbol in ["NIFTY", "BANKNIFTY", "MIDCPNIFTY", "SENSEX"]:
        instrument = get_instrument(symbol) or {
            "symbol": symbol,
            "name": symbol,
            "exchange": "NSE" if symbol != "SENSEX" else "BSE",
            "token": None,
        }
        tick = mw_latest.get(symbol) or {}
        ltp = tick.get("ltp")
        previous_ltp = tick.get("previous_ltp")
        change = None
        change_pct = None
        if ltp is not None and previous_ltp:
            try:
                change = round(float(ltp) - float(previous_ltp), 2)
                change_pct = round((change / float(previous_ltp)) * 100.0, 2)
            except (TypeError, ValueError):
                change = None
                change_pct = None
        indices.append({
            "symbol": symbol,
            "name": instrument.get("name"),
            "exchange": instrument.get("exchange"),
            "token": None,  # SECURITY: redacted
            "ltp": ltp,
            "change": change,
            "change_pct": change_pct,
            "last_update": tick.get("received_at"),
            "status": "live" if ltp is not None else "unavailable",
        })
    return {"indices": indices}


@app.get("/instruments")
@limiter.limit("30/minute")
def list_instruments(
    request: Request,
    exchange: str = Query(default="NSE"),
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    include_virtual: bool = Query(default=True),
):
    """Return the full instrument universe (with optional filter + paging).

    Designed for the watchlist search dropdown — the frontend debounces typing
    into the search field and queries /instruments/search for the fuzzy match;
    /instruments is for the cold-open "browse all" path.
    """
    _ensure_instrument_master_loaded()
    items = instrument_registry.load_instruments(force_reload=False) or []
    if include_virtual:
        from backend.gateway.instrument_registry import _VIRTUAL_INDEX_INSTRUMENTS  # type: ignore
        items = list(items) + list(_VIRTUAL_INDEX_INSTRUMENTS.values())
    # Stable sort by symbol for deterministic pagination.
    items.sort(key=lambda x: str(x.get("symbol") or ""))
    total = len(items)
    page = items[offset : offset + limit]
    return sanitize_response({
        "exchange": exchange,
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": page,
    })


@app.post("/ws/subscribe", dependencies=[Depends(require_admin_token)])
async def ws_subscribe(payload: WsSubscribeRequest):
    """Update the gateway's live subscription set without dropping the WS.

    The frontend can use this to add a single symbol when the user drops it on
    the watchlist (add=True) or remove one (add=False). Returns the merged
    market-watch snapshot so the client can re-render in one round-trip.
    """
    if not payload.symbols:
        raise HTTPException(status_code=400, detail="symbols must not be empty")
    valid, invalid = instrument_registry.validate_symbols(payload.symbols)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Unknown symbols rejected", "invalid_symbols": invalid},
        )

    current = set(market_watch.symbols)
    if payload.add:
        next_set = current.union(valid)
    else:
        next_set = current.difference(valid)
    new_symbols, _ = market_watch.set_symbols(sorted(next_set))

    if gateway and gateway.connection_state in ("CONNECTING", "CONNECTED", "RECONNECTING"):
        try:
            await gateway.update_subscriptions(new_symbols)
        except Exception as exc:
            logger.warning("gateway.update_subscriptions failed: %s", exc.__class__.__name__)

    return sanitize_response({
        "status": "success",
        "action": "add" if payload.add else "remove",
        "symbols": new_symbols,
        "items": market_watch.snapshot(),
    })


@app.get("/market-watch/protected")
def get_protected_market_watch_symbols():
    """The protected index symbols (NIFTY/BANKNIFTY/MIDCPNIFTY/SENSEX) cannot be
    removed by the user. This endpoint exposes the list so the frontend can
    disable the remove button on those rows in the watchlist UI."""
    return sanitize_response({
        "protected": list(market_watch.protected_symbols),
    })


@app.get("/terminal/status")
def terminal_status():
    gateway_status = gateway.status() if gateway else None
    return sanitize_response({
        "app": {"status": "online"},
        "broker": get_broker_status(),
        "gateway": gateway_status,
        "event_bus": event_bus.get_stats(),
        "tick_bus": tick_bus.stats() if tick_bus else None,
        "candles": candle_store.stats(),
        "indicator_engine": {"available": True, **indicator_engine.status()},
        "strategy_engine": {
            "backtesting_enabled": True,
            "live_execution_enabled": False,
            "templates_count": len(get_strategy_templates()),
        },
        "execution": router.status(),
        "portfolio": portfolio_engine.get_summary(),
        "trading_mode": execution_mode,
        "demo_mode": settings.demo_mode,
        "demo_banner": "DEMO MODE - No real trading" if settings.demo_mode else None,
    })

@app.get("/ws/status")
def websocket_status():
    return sanitize_response(broadcaster.status(route_paths=websocket_route_paths()))

@app.post("/toggle_mode")
async def toggle_mode(mode: str, confirm: bool = False):
    global execution_mode, router
    if mode not in ["PAPER", "LIVE"]:
        raise HTTPException(status_code=400, detail="Invalid mode")

    if mode == "LIVE":
        allowed = await router.switch_to_live(confirm=confirm)
        if not allowed:
            raise HTTPException(status_code=403, detail="Live trading remains locked")
        execution_mode = "LIVE"
        logger.info("TERMINAL: Mode switched to LIVE")
        return {"status": "success", "new_mode": execution_mode}
    
    execution_mode = "PAPER"
    await router.switch_to_paper()
    logger.info(f"TERMINAL: Mode switched to {execution_mode}")
    return {"status": "success", "new_mode": execution_mode}

@app.post("/order")
async def place_order(side: str, qty: int, symbol: str = "SBIN-EQ"):
    instrument = get_instrument(symbol)
    token = str(instrument.get("token")) if instrument and instrument.get("token") else None
    if not token:
        raise HTTPException(status_code=404, detail="Unknown symbol")

    price_data = gateway.latest_data.get(token) if gateway else None
    
    if not price_data:
        raise HTTPException(status_code=400, detail="Market data not available for symbol")

    price = price_data["ltp"]

    # Route via ExecutionRouter
    from backend.core.events import OrderRequestEvent
    from backend.core.types import OrderType

    order_request = OrderRequestEvent(
        symbol=symbol,
        side=side,
        quantity=qty,
        order_type=OrderType.MARKET.value,
        price=price,
        strategy_name="MANUAL",
        signal_event_id=None,
        trading_mode=execution_mode,
        source="MANUAL",
    )

    # Execute
    res_event = await router.route(order_request, latest_market={"ltp": price, "received_at": datetime.now(timezone.utc)})

    return {
        "status": res_event.status,
        "order_id": res_event.order_id,
        "filled_qty": res_event.filled_quantity,
        "price": res_event.avg_fill_price,
        "reason": res_event.reject_reason
    }

@app.get("/orders/audit/recent", dependencies=[Depends(require_admin_token)])
async def get_recent_orders(limit: int = Query(default=50, ge=1, le=100)):
    raw_requests = router.order_store.get_recent_requests(limit=limit)
    sanitized_requests = []
    for req in raw_requests:
        req_id = req.get("request_id")
        events = router.order_store.get_order_events(req_id)
        sanitized_events = [dict(ev) for ev in events]
        sanitized_requests.append({
            **dict(req),
            "events": sanitized_events
        })
    return sanitize_response({"orders": sanitized_requests})


# =============================================================================
# Prompt 2: Dual-source market data endpoints (Yahoo + Angel + Supabase cache)
# =============================================================================
# These routes are public read-only — the terminal uses them to render the
# landing-page market strip, the screener, and the candle chart. No
# mutations; no auth required; rate-limited via the existing limiter.
from backend.data.market_data import (
    get_candles,
    get_quote,
    get_quotes_bulk,
    search as md_search,
    get_market_overview,
    get_indices as md_get_indices,
    get_scanner,
    get_market_mood,
    get_movers,
    _is_market_hours,
)
from backend.data.symbol_universe import (
    get_all_nse_symbols,
    get_indices as get_index_list,
    get_sectors,
)
import pytz as _pytz

_MARKET_DATA_IST = _pytz.timezone("Asia/Kolkata")


@app.get("/api/quote/{symbol}")
async def api_get_quote(symbol: str, exchange: str = "NSE"):
    """Get live quote for a symbol. Yahoo (delayed) or Angel (live) depending
    on market hours and credentials."""
    from backend.data.market_data import _INDEX_TICKER_MAP, _fetch_index_quote
    sym_upper = symbol.upper()
    # Indices like NIFTY/SENSEX need Yahoo's caret-prefixed tickers.
    if sym_upper in _INDEX_TICKER_MAP:
        q = _fetch_index_quote(_INDEX_TICKER_MAP[sym_upper])
        if q:
            # Rewrite the symbol back to the user-facing name (NIFTY not ^NSEI)
            q["symbol"] = sym_upper
    else:
        q = get_quote(sym_upper, exchange.upper())
    if not q:
        raise HTTPException(
            status_code=503,
            detail=f"Quote unavailable for {symbol}. Check the symbol or try again later.",
        )
    return q


@app.post("/api/quotes/bulk")
async def api_quotes_bulk(body: dict):
    """Bulk fetch quotes. Body: ``{"symbols": ["RELIANCE", "TCS", ...]}``.

    Capped at 50 symbols per call to protect Yahoo's free tier from
    rate-limiting. Returns ``{"quotes": {symbol: quote, ...}}``.
    """
    symbols = body.get("symbols", [])
    if not symbols:
        return {"quotes": {}}
    symbols = [str(s).upper() for s in symbols][:50]
    quotes = get_quotes_bulk(symbols)
    return {"quotes": quotes}


@app.get("/api/search")
async def api_search(q: str = "", limit: int = 20):
    """Search NSE/BSE symbols. Local universe first (fast), Yahoo as fallback."""
    if not q or len(q.strip()) < 1:
        return {"results": []}
    results = md_search(q)[:limit]
    return {"results": results}


@app.get("/api/candles")
async def api_candles(
    symbol: str,
    exchange: str = "NSE",
    interval: str = "1D",
    lookback: int = 7300,
):
    """Get OHLCV candle data.

    Intervals: ``1m`` (7d), ``5m``/``15m`` (60d), ``1h`` (730d),
    ``1D``/``1W``/``1MO`` (max ≈ 20 years).
    """
    if interval not in ("1m", "5m", "15m", "1h", "1D", "1W", "1MO"):
        raise HTTPException(status_code=400, detail=f"Invalid interval: {interval}")
    candles = get_candles(symbol.upper(), exchange.upper(), interval, lookback)
    return {
        "symbol": symbol.upper(),
        "exchange": exchange.upper(),
        "interval": interval,
        "candles": candles,
        "count": len(candles),
    }


@app.get("/api/market/overview")
async def api_market_overview():
    """Top 20 NSE stocks for the landing-page ticker strip."""
    try:
        return {"stocks": get_market_overview()}
    except Exception as e:
        msg = safe_error_message(e)
        logger.warning(f"[api] market/overview failed: {msg}")
        return {"stocks": []}


@app.get("/api/market/indices")
async def api_market_indices():
    """Major indices: NIFTY, BANKNIFTY, SENSEX."""
    try:
        return {"indices": md_get_indices()}
    except Exception as e:
        msg = safe_error_message(e)
        logger.warning(f"[api] market/indices failed: {msg}")
        return {"indices": []}


@app.get("/api/market/mood")
@limiter.limit("10/minute")
async def api_market_mood():
    """Fear/Greed breadth score (0-100) for the NIFTY 50 universe."""
    try:
        return {"mood": get_market_mood()}
    except Exception as e:
        msg = safe_error_message(e)
        logger.warning(f"[api] market/mood failed: {msg}")
        return {
            "mood": {
                "score": 50, "label": "Neutral",
                "advances": 0, "declines": 0, "unchanged": 0, "total": 0,
            }
        }


@app.get("/api/market/movers")
@limiter.limit("10/minute")
async def api_market_movers(
    direction: str = "gainers",
    limit: int = 25,
):
    """Top movers: gainers / losers / active / 52w_high / 52w_low."""
    valid = ("gainers", "losers", "active", "52w_high", "52w_low")
    if direction not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid direction: {direction}. Must be one of {list(valid)}",
        )
    limit = min(max(limit, 1), 50)
    try:
        return {"direction": direction, "stocks": get_movers(direction, limit)}
    except Exception as e:
        msg = safe_error_message(e)
        logger.warning(f"[api] market/movers failed: {msg}")
        return {"direction": direction, "stocks": []}


@app.get("/api/market/status")
async def api_market_status():
    """Market open/closed status (IST, Mon-Fri 09:15-15:30)."""
    now = datetime.now(_MARKET_DATA_IST)
    return {
        "isOpen": _is_market_hours(),
        "now": now.isoformat(),
        "session": "OPEN" if _is_market_hours() else "CLOSED",
    }


@app.get("/api/scanner")
async def api_scanner(
    exchange: str = "NSE",
    sector: str = "ALL",
    minChange: float = -100.0,
    maxChange: float = 100.0,
    minVolume: int = 0,
):
    """Market scanner with filters. ``sector=ALL`` to disable sector filter."""
    try:
        return {
            "stocks": get_scanner(
                exchange=exchange,
                sector=sector,
                min_change=minChange,
                max_change=maxChange,
                min_volume=minVolume,
            )
        }
    except Exception as e:
        # Yahoo throttling can still 500 even with our 50-cap. Never let
        # the scanner endpoint return 500 — that's worse than empty.
        msg = safe_error_message(e)
        logger.warning(f"[api] scanner failed: {msg}")
        return {"stocks": [], "warning": "scanner temporarily unavailable"}


@app.get("/api/symbols")
async def api_symbols():
    """List all known NSE symbols with sector info (cached, fast)."""
    universe = get_all_nse_symbols()
    return {
        "symbols": [
            {"symbol": s, "name": n, "sector": sec, "exchange": "NSE"}
            for s, n, sec in universe
        ]
    }


@app.get("/api/symbols/sectors")
async def api_symbols_sectors():
    """Distinct sector list — drives the scanner dropdown."""
    return {"sectors": get_sectors()}


# End Prompt 2 market-data endpoints
# =============================================================================


def _validate_websocket_auth(websocket: WebSocket) -> bool:
    """Validate WebSocket authentication. Returns True if authenticated.

    Accepts JWT via:
      - query param ?token=<jwt>
      - Sec-WebSocket-Protocol header (sometimes used to pass tokens)

    Also validates the Origin header against the CORS allowlist.
    """
    from backend.core.security import decode_access_token, sanitize_response
    import hmac as _hmac

    # 1. Origin check — prevents browser-based CSRF-style WS handshakes from
    #    attacker sites. WebSockets don't honor CORS, so this must be explicit.
    origin = websocket.headers.get("origin", "")
    if origin:
        allowed = get_cors_origins()
        if allowed and origin not in allowed:
            return False

    # 2. Token extraction — query string is the standard pattern
    token = None
    if websocket.query_params.get("token"):
        token = websocket.query_params.get("token")

    # 3. Legacy X-Admin-Token support for compatibility
    if not token and settings.admin_token:
        candidate = websocket.headers.get("x-admin-token") or websocket.query_params.get("admin_token")
        if candidate and _hmac.compare_digest(candidate, settings.admin_token):
            return True

    if not token:
        return False

    payload = decode_access_token(token)
    return payload is not None


@app.websocket("/ws/market_stream")
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """Handles frontend terminal connections via the unified broadcaster.
    Requires JWT or admin token; Origin is checked against CORS allowlist.
    """
    # Reject unauthenticated connections BEFORE accepting the handshake
    if not _validate_websocket_auth(websocket):
        await websocket.close(code=1008, reason="Unauthorized")
        obs_timeline.record_state_change("websocket", "REJECTED", websocket.url.path)
        return

    await broadcaster.connect(websocket)
    obs_timeline.record_state_change("websocket", "CONNECTED", websocket.url.path)
    await websocket.send_json({
        "type": "gateway_status",
        "payload": gateway.status() if gateway else {"connection_state": "DISCONNECTED"},
        "ts": utc_timestamp(),
    })
    try:
        while True:
            message = await websocket.receive_text()
            if is_client_ping(message):
                await websocket.send_json({
                    "type": "pong",
                    "payload": {"source": "server"},
                    "ts": utc_timestamp(),
                })
    except WebSocketDisconnect as e:
        broadcaster.disconnect(websocket, close_code=getattr(e, "code", None))
        obs_timeline.record_state_change("websocket", "DISCONNECTED", websocket.url.path)
    except Exception as e:
        logger.error("WS: Client connection error: %s", e.__class__.__name__)
        broadcaster.disconnect(websocket)
        obs_timeline.record_state_change("websocket", "ERROR", e.__class__.__name__)

def is_client_ping(message: str) -> bool:
    if message.strip().lower() == "ping":
        return True
    try:
        payload = json.loads(message)
    except json.JSONDecodeError:
        return False
    if not isinstance(payload, dict):
        return False
    message_type = str(payload.get("type", "")).strip().lower()
    return message_type == "ping"
