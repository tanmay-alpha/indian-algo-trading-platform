# backend/api_server.py

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

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
    message = str(error) or error.__class__.__name__
    sensitive_terms = ("api_key", "password", "secret", "jwt", "refresh", "feed", "token")
    if any(term in message.lower() for term in sensitive_terms):
        return error.__class__.__name__
    return message

@asynccontextmanager
async def lifespan(_: FastAPI):
    await startup_event()
    try:
        yield
    finally:
        await shutdown_event()


app = FastAPI(title="High-Frequency Trading Terminal", lifespan=lifespan)
register_rate_limiter(app)

def get_cors_origins() -> list[str]:
    required_origins = [
        "https://indian-algo-trading-platform.vercel.app",
        "http://localhost:3000",
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
    allow_methods=["*"],
    allow_headers=["*"],
)
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
    "loaded": len(instrument_registry.load_instruments()),
    "source": "fallback",
    "cached_at": None,
    "cache_fresh": False,
    "fallback_active": True,
}
instrument_loader = InstrumentLoader(timeout_seconds=8)
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
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)

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
    await orchestrator.startup(app.state)

async def shutdown_event():
    await orchestrator.shutdown()

def check_database_status():
    from backend.core.security import _db_engine
    from backend.core.database import create_engine_safe, check_db_health, redact_db_url, get_database_url
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
    for symbol in ["NIFTY", "BANKNIFTY", "SENSEX"]:
        instrument = get_instrument(symbol) or {
            "symbol": symbol,
            "name": symbol,
            "exchange": "NSE" if symbol != "SENSEX" else "BSE",
            "token": None,
        }
        indices.append({
            "symbol": symbol,
            "name": instrument.get("name"),
            "exchange": instrument.get("exchange"),
            "token": None,  # SECURITY: redacted
            "ltp": None,
            "change": None,
            "change_pct": None,
            "status": "unavailable",
        })
    return {"indices": indices}

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

@app.websocket("/ws/market_stream")
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """Handles frontend terminal connections via the unified broadcaster."""
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
