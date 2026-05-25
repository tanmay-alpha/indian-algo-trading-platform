# backend/api_server.py

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from backend.candles.candle_fetcher import CandleFetcher
from backend.candles.candle_store import CandleStore
from backend.core.config import settings
from backend.core.event_bus import EventBus
from backend.core.events import EventType, TickEvent, event_to_dict, SignalEvent, OrderRequestEvent, OrderStateEvent
from backend.core.rate_limit import limiter, register_rate_limiter
from backend.core.security import require_admin_token, sanitize_response
from backend.routers import candles as candles_router
from backend.routers import indicators as indicators_router
from backend.routers import portfolio as portfolio_router
from backend.routers import strategies as strategies_router
from backend.routers import discovery as discovery_router
from backend.routers import observability as observability_router
from backend.indicators.engine import IndicatorEngine
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.templates import get_strategy_templates
from backend.discovery.market_board import MarketBoard
from backend.discovery.screener_engine import ScreenerEngine
from backend.gateway import instrument_registry
from backend.gateway.instrument_loader import InstrumentLoader
from backend.gateway.market_gateway import MarketDataGateway
from backend.gateway.tick_bus import TickBus
from backend.gateway.market_watch import MarketWatch
from backend.gateway.instrument_registry import search_symbols, get_instrument
from backend.execution.execution_router import ExecutionRouter
from backend.portfolio.portfolio_manager import PortfolioManager
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.risk.risk_manager import RiskManager
from backend.engine.strategy_engine import StrategyEngine
from backend.core.broadcaster import WebSocketBroadcaster
from backend.core.session_manager import SessionManager
from backend.observability.metrics_store import MetricsStore, start_sampler
from backend.observability.event_log import ObservabilityEventLog
from backend.observability.health_timeline import HealthTimeline

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
    origins = settings.allowed_origin_list or ["http://localhost:3000"]
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
portfolio = PortfolioManager(initial_capital=50000)
risk = RiskManager(initial_capital=50000)
strategy = StrategyEngine()

auto_pilot = False
last_trade_time = 0
trade_cooldown = 60 # 60 seconds safety cooldown

execution_mode = "PAPER"
portfolio_engine = PortfolioEngine(initial_capital=50000, event_bus=event_bus, trading_mode=execution_mode)
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
app.state.backtest_history = []

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

async def event_to_ws_bridge(event):
    event_type = getattr(event, "event_type", "unknown")
    type_str = event_type.lower() if isinstance(event_type, str) else str(event_type).lower()
    await websocket_broadcast({
        "type": type_str,
        "payload": event_to_dict(event),
        "ts": utc_timestamp(),
    })

async def observability_event_recorder(event):
    obs_event_log.record(event)

async def gateway_status_to_timeline(event):
    obs_timeline.record_state_change(
        "gateway",
        getattr(event, "status", None) or getattr(event, "connection_state", None) or "UNKNOWN",
        getattr(event, "detail", "") or "",
    )

async def session_to_timeline(event):
    obs_timeline.record_state_change(
        "session",
        getattr(event, "status", None) or "UNKNOWN",
        getattr(event, "detail", "") or "",
    )

from backend.strategy.signal_validator import SignalValidator
from backend.core.types import OrderStatus

signal_validator = SignalValidator(
    event_bus=event_bus,
    kill_switch=router.kill_switch,
    live_trading_enabled=settings.live_trading_enabled,
    default_quantity=1,
)

async def on_signal_event(event: SignalEvent):
    """Handles auto-pilot routing of signals."""
    global last_trade_time
    if not auto_pilot:
        return
    # Check cooldown
    now = asyncio.get_event_loop().time()
    if now - last_trade_time <= trade_cooldown:
        logger.debug(f"AUTOPILOT: Cooldown active, skipping signal for {event.symbol}")
        return
    # Route via SignalValidator
    order_request = await signal_validator.validate_and_route(event, trading_mode=execution_mode)
    if order_request:
        last_trade_time = now

async def on_order_request_event(event: OrderRequestEvent):
    """Routes validated order requests to execution."""
    await router.route(event)

async def on_order_state_event_legacy_updater(event: OrderStateEvent):
    """Asynchronously updates legacy portfolio and risk on fills."""
    if event.status == OrderStatus.FILLED.value:
        portfolio.open_position(event.symbol, event.side, event.quantity, event.avg_fill_price)
        risk.open_position(event.symbol, event.side, event.quantity, event.avg_fill_price)
        logger.info(f"ORDER STATE UPDATER: Position opened/updated asynchronously for {event.symbol} {event.side} @ {event.avg_fill_price}")

event_bus.subscribe(EventType.TICK.value, candle_store.on_tick_event)
event_bus.subscribe(EventType.ORDER_STATE.value, portfolio_engine.on_order_state_event)
event_bus.subscribe(EventType.ORDER_STATE.value, on_order_state_event_legacy_updater)
event_bus.subscribe(EventType.SIGNAL.value, on_signal_event)
event_bus.subscribe(EventType.ORDER_REQUEST.value, on_order_request_event)
event_bus.subscribe("*", observability_event_recorder)
event_bus.subscribe(EventType.GATEWAY_STATUS.value, gateway_status_to_timeline)
event_bus.subscribe(EventType.SESSION.value, session_to_timeline)

for bridged_type in (
    EventType.SIGNAL.value,
    EventType.PORTFOLIO.value,
    EventType.GATEWAY_STATUS.value,
    EventType.SESSION.value,
    EventType.ERROR.value,
):
    event_bus.subscribe(bridged_type, event_to_ws_bridge)

def get_broker_status():
    if gateway:
        gateway_status = gateway.status()
        broker_status.update({
            "logged_in": bool(session_manager and session_manager.is_valid),
            "feed_token_available": bool(session_manager and session_manager.feed_token),
            "websocket_started": gateway_status["connection_state"] in ["CONNECTING", "CONNECTED", "RECONNECTING"],
            "last_error": gateway_status.get("last_error") or (session_manager.last_error if session_manager else None),
            "gateway": gateway_status,
        })
    elif session_manager:
        broker_status.update({
            "logged_in": session_manager.is_valid,
            "feed_token_available": bool(session_manager.feed_token),
            "last_error": session_manager.last_error,
        })
    return broker_status.copy()

async def start_gateway(loop):
    """Create and start broker connectivity without crashing the app."""
    global gateway, tick_bus, session_manager, tick_consumer_task
    try:
        if session_manager is None:
            session_manager = SessionManager()
            app.state.session_manager = session_manager

        global candle_fetcher
        if candle_fetcher is None:
            candle_fetcher = CandleFetcher(
                session_manager=session_manager,
                candle_store=candle_store,
                registry=instrument_registry,
            )
            app.state.candle_fetcher = candle_fetcher

        initialized = await session_manager.initialize()
        if not initialized:
            broker_status.update({
                "logged_in": False,
                "feed_token_available": False,
                "websocket_started": False,
                "last_error": session_manager.last_error,
            })
            return False

        if tick_bus is None:
            tick_bus = TickBus()
            app.state.tick_bus = tick_bus

        if gateway is None:
            gateway = MarketDataGateway(session_manager=session_manager, tick_bus=tick_bus, loop=loop)
            gateway.set_event_bus(event_bus)
            app.state.gateway = gateway

        if tick_consumer_task is None or tick_consumer_task.done():
            tick_consumer_task = asyncio.create_task(consume_tick_bus())

        started = await gateway.start(market_watch.symbols)
        get_broker_status()
        return started
    except Exception as e:
        broker_status.update({
            "logged_in": False,
            "feed_token_available": False,
            "websocket_started": False,
            "last_error": safe_error_message(e),
        })
        logger.error("MDG: Gateway startup failed: %s", broker_status["last_error"])  # SECURITY: redacted
        return False

async def start_gateway_background(loop):
    await start_gateway(loop)

async def load_instrument_master_best_effort():
    global instrument_master_status
    source = "fallback"
    try:
        master_instruments = await asyncio.wait_for(instrument_loader.load(), timeout=12)
        if master_instruments:
            loaded = instrument_registry.load_from_master(master_instruments)
            if loaded:
                source = getattr(instrument_loader, "_last_source", "cache")
        status = instrument_registry.registry_status()
        instrument_registry.set_master_source(source if status["loaded"] > 0 else "fallback")
        instrument_master_status = {
            "loaded": status["loaded"],
            "source": source if not status["fallback_active"] else "fallback",
            "cached_at": get_instrument_cache_timestamp(instrument_loader),
            "cache_fresh": instrument_loader.cache_is_fresh(),
            "fallback_active": status["fallback_active"],
        }
        logger.info(
            "Instrument master loaded: %s symbols from %s",
            instrument_master_status["loaded"],
            instrument_master_status["source"],
        )
    except Exception as e:
        status = instrument_registry.registry_status()
        instrument_master_status = {
            "loaded": status["loaded"],
            "source": "fallback",
            "cached_at": get_instrument_cache_timestamp(instrument_loader),
            "cache_fresh": instrument_loader.cache_is_fresh(),
            "fallback_active": True,
        }
        logger.warning("Instrument master load failed: %s; using fallback symbols", e.__class__.__name__)

def get_instrument_cache_timestamp(loader: InstrumentLoader) -> str | None:
    try:
        if not loader.meta_path.exists():
            return None
        meta = json.loads(loader.meta_path.read_text(encoding="utf-8"))
        cached_at = meta.get("cached_at")
        return str(cached_at) if cached_at else None
    except (OSError, json.JSONDecodeError):
        return None

async def consume_tick_bus():
    while True:
        event = await tick_bus.get()
        if event.get("event_type") != "tick":
            continue

        market_watch.update_tick(event)

        tick_event = TickEvent(
            symbol=event.get("symbol") or "",
            token=event.get("token"),
            exchange=event.get("exchange") or "NSE",
            ltp=event.get("ltp"),
            best_bid=event.get("best_bid"),
            best_ask=event.get("best_ask"),
            bid_qty=event.get("bid_qty"),
            ask_qty=event.get("ask_qty"),
            spread=event.get("spread"),
            vwap=event.get("vwap"),
            volume=event.get("volume"),
            ltq=event.get("ltq"),
            exchange_timestamp=event.get("exchange_timestamp") or event.get("timestamp"),
            received_at=parse_event_datetime(event.get("received_at")),
        )
        await event_bus.publish(tick_event)

        symbol = event.get("symbol")
        ltp = event.get("ltp")
        if not symbol or ltp is None:
            continue

        strategy_tick = event.copy()
        strategy_tick["price"] = ltp
        strategy_tick["event_id"] = tick_event.event_id
        await process_tick(strategy_tick)

async def process_tick(tick: dict):
    """Processes a live market tick: Updates strategy, risk, and portfolio."""
    global last_trade_time
    symbol = tick["symbol"]
    price = tick["price"]
    vwap = tick.get("vwap")

    # Update Strategy with VWAP
    # Generate SignalEvent and publish to EventBus
    signal_event = strategy.generate_signal(symbol, price, vwap, tick_event_id=tick.get("event_id"))
    signal = signal_event.action
    await event_bus.publish(signal_event)
    
    # Update Portfolio Unrealized PnL
    portfolio.update_unrealized(symbol, price)
    await portfolio_engine.on_tick(symbol, price)
    
    # Enrichment
    tick.update({
        "signal": signal,
        "portfolio": portfolio.get_performance(),
        "mode": execution_mode,
        "auto_pilot": auto_pilot
    })
    
    # --- Autonomous Order Logic ---
    if False:  # Deprecated in favor of event-driven execution
        now = asyncio.get_event_loop().time()
        if now - last_trade_time > trade_cooldown:
            if risk.can_take_trade(symbol):
                logger.info(f"AUTOPILOT: Triggering {signal} for {symbol} @ {price}")
                res = router.place_order(symbol, tick["token"], signal, 1, price)
                if res["status"] in ["SUCCESS", "PAPER_EXECUTED"]:
                    portfolio.open_position(symbol, signal, 1, price)
                    risk.open_position(symbol, signal, 1, price)
                    last_trade_time = now
    
    # Broadcast to all terminal clients
    await websocket_broadcast({
        "type": "tick",
        "payload": tick,
        "ts": utc_timestamp(),
    })

@app.post("/toggle_auto_pilot")
def toggle_auto_pilot():
    global auto_pilot
    auto_pilot = not auto_pilot
    logger.info(f"TERMINAL: Auto-Pilot switched {'ON' if auto_pilot else 'OFF'}")
    return {"status": "success", "auto_pilot": auto_pilot}

async def startup_event():
    """Initializes the backend services on startup."""
    global sampler_task
    loop = asyncio.get_running_loop()
    
    # Start Broadcaster Service
    broadcaster.start(loop)
    if sampler_task is None or sampler_task.done():
        sampler_task = asyncio.create_task(
            start_sampler(obs_metrics, app.state, interval_seconds=60)
        )
        app.state.sampler_task = sampler_task

    await load_instrument_master_best_effort()
    
    # Start broker connectivity separately so failed login cannot crash the API.
    asyncio.create_task(start_gateway_background(loop))
    
    if settings.demo_mode:
        logger.info("DEMO MODE enabled")

    logger.info(f"TERMINAL: Backend operational in {execution_mode} mode")

async def shutdown_event():
    if sampler_task and not sampler_task.done():
        sampler_task.cancel()
        try:
            await sampler_task
        except asyncio.CancelledError:
            pass

@app.get("/")
@app.get("/health")
def health_check():
    return sanitize_response({
        "status": "online",
        "mode": execution_mode,
        "broker": get_broker_status(),
        "portfolio": portfolio.get_performance(),
        "portfolio_engine": portfolio_engine.get_summary(),
    })

@app.get("/live")
def live_check():
    return {"status": "alive"}

@app.get("/ready")
def ready_check():
    db_path = Path(settings.db_path)
    db_parent = db_path.parent if db_path.parent != Path("") else Path(".")
    gateway_status = gateway.status() if gateway else None
    return sanitize_response({
        "status": "ready",
        "app": {"status": "online", "environment": settings.environment},
        "broker": get_broker_status(),
        "gateway": gateway_status,
        "database": {
            "path_configured": bool(settings.db_path),
            "parent_exists": db_parent.exists(),
            "path": settings.db_path,
        },
        "trading_mode": execution_mode,
        "live_trading_enabled": settings.live_trading_enabled,
    })

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
    return sanitize_response({
        "symbols": market_watch.symbols,
        "items": market_watch.snapshot(),
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
    if False:
        return {"status": "REJECTED", "reason": "Risk limits exceeded"}

    # Execute
    res_event = await router.route(order_request, latest_market={"ltp": price, "received_at": datetime.now(timezone.utc)})
    
    if False:  # deprecated synchronous update
        portfolio.open_position(symbol, side, qty, price)
        risk.open_position(symbol, side, qty, price)
        logger.info(f"ORDER: {side} executed for {qty} {symbol} @ {price}")

    return {
        "status": res_event.status,
        "order_id": res_event.order_id,
        "filled_qty": res_event.filled_quantity,
        "price": res_event.avg_fill_price,
        "reason": res_event.reject_reason
    }

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
