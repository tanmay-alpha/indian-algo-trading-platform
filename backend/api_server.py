# backend/api_server.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from backend.candles.candle_fetcher import CandleFetcher
from backend.candles.candle_store import CandleStore
from backend.core.config import settings
from backend.core.event_bus import EventBus
from backend.core.events import EventType, TickEvent, event_to_dict
from backend.routers import candles as candles_router
from backend.routers import portfolio as portfolio_router
from backend.gateway import instrument_registry
from backend.gateway.market_gateway import MarketDataGateway
from backend.gateway.tick_bus import TickBus
from backend.gateway.market_watch import MarketWatch
from backend.gateway.instrument_registry import search_symbols, get_instrument, validate_symbols
from backend.execution.execution_router import ExecutionRouter
from backend.portfolio.portfolio_manager import PortfolioManager
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.risk.risk_manager import RiskManager
from backend.engine.strategy_engine import StrategyEngine
from backend.core.broadcaster import WebSocketBroadcaster
from backend.core.session_manager import SessionManager

# --- Global Logger ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def safe_error_message(error):
    message = str(error) or error.__class__.__name__
    sensitive_terms = ("api_key", "password", "secret", "jwt", "refresh", "feed", "token")
    if any(term in message.lower() for term in sensitive_terms):
        return error.__class__.__name__
    return message

app = FastAPI(title="High-Frequency Trading Terminal")

def get_cors_origins() -> list[str]:
    local_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    configured = settings.allowed_origin_list
    origins = list(dict.fromkeys([*local_origins, *configured]))
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
app.include_router(portfolio_router.router)

# --- Components ---
broadcaster = WebSocketBroadcaster()
gateway = None
tick_bus = None
session_manager = None
tick_consumer_task = None
event_bus = EventBus()
candle_store = CandleStore()
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

class MarketWatchRequest(BaseModel):
    symbols: list[str]

app.state.event_bus = event_bus
app.state.candle_store = candle_store
app.state.candle_fetcher = candle_fetcher
app.state.market_watch_state = market_watch
app.state.session_manager = session_manager
app.state.portfolio_engine = portfolio_engine

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

event_bus.subscribe(EventType.TICK.value, candle_store.on_tick_event)
event_bus.subscribe(EventType.ORDER_STATE.value, portfolio_engine.on_order_state_event)
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

        if gateway is None:
            gateway = MarketDataGateway(session_manager=session_manager, tick_bus=tick_bus, loop=loop)
            gateway.set_event_bus(event_bus)

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
        logger.error(f"MDG: Gateway startup failed: {broker_status['last_error']}")
        return False

async def start_gateway_background(loop):
    await start_gateway(loop)

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
        await process_tick(strategy_tick)

async def process_tick(tick: dict):
    """Processes a live market tick: Updates strategy, risk, and portfolio."""
    global last_trade_time
    symbol = tick["symbol"]
    price = tick["price"]
    vwap = tick.get("vwap")

    # Update Strategy with VWAP
    signal = strategy.update_price(price, vwap)
    
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
    if auto_pilot and signal in ["BUY", "SELL"]:
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

@app.on_event("startup")
async def startup_event():
    """Initializes the backend services on startup."""
    loop = asyncio.get_running_loop()
    
    # Start Broadcaster Service
    broadcaster.start(loop)
    
    # Start broker connectivity separately so failed login cannot crash the API.
    asyncio.create_task(start_gateway_background(loop))
    
    logger.info(f"TERMINAL: Backend operational in {execution_mode} mode")

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "mode": execution_mode,
        "broker": get_broker_status(),
        "portfolio": portfolio.get_performance(),
        "portfolio_engine": portfolio_engine.get_summary(),
    }

@app.get("/live")
def live_check():
    return {"status": "alive"}

@app.get("/ready")
def ready_check():
    db_path = Path(settings.db_path)
    db_parent = db_path.parent if db_path.parent != Path("") else Path(".")
    gateway_status = gateway.status() if gateway else None
    return {
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
    }

@app.get("/instruments/search")
def search_instruments(q: str = Query(default=""), limit: int = Query(default=20, ge=1, le=100)):
    return {
        "query": q,
        "results": search_symbols(q, limit=limit) if q else [],
    }

@app.get("/market-watch")
def get_market_watch():
    return {
        "symbols": market_watch.symbols,
        "items": market_watch.snapshot(),
    }

@app.post("/market-watch")
async def update_market_watch(payload: MarketWatchRequest):
    valid, invalid = market_watch.set_symbols(payload.symbols)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Unknown symbols rejected", "invalid_symbols": invalid},
        )

    if gateway and gateway.connection_state in ["CONNECTING", "CONNECTED", "RECONNECTING"]:
        await gateway.update_subscriptions(valid)

    return {
        "status": "success",
        "symbols": valid,
        "items": market_watch.snapshot(),
    }

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
            "token": instrument.get("token"),
            "ltp": None,
            "change": None,
            "change_pct": None,
            "status": "unavailable",
        })
    return {"indices": indices}

@app.get("/terminal/status")
def terminal_status():
    gateway_status = gateway.status() if gateway else None
    return {
        "app": {"status": "online"},
        "broker": get_broker_status(),
        "gateway": gateway_status,
        "event_bus": event_bus.get_stats(),
        "tick_bus": tick_bus.stats() if tick_bus else None,
        "candles": candle_store.stats(),
        "execution": router.status(),
        "portfolio": portfolio_engine.get_summary(),
        "trading_mode": execution_mode,
    }

@app.get("/ws/status")
def websocket_status():
    return broadcaster.status(route_paths=websocket_route_paths())

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
def place_order(side: str, qty: int, symbol: str = "SBIN-EQ"):
    # Find the token if we want to handle multiple symbols
    # For now, default to SBIN-EQ mapping
    token = "3045"
    price_data = gateway.latest_data.get(token) if gateway else None
    
    if not price_data:
        raise HTTPException(status_code=400, detail="Market data not available for symbol")

    price = price_data["ltp"]

    # Check Risk
    if not risk.can_take_trade(symbol):
        return {"status": "REJECTED", "reason": "Risk limits exceeded"}

    # Execute
    res = router.place_order(symbol, token, side, qty, price)
    
    if res["status"] in ["SUCCESS", "PAPER_EXECUTED"]:
        portfolio.open_position(symbol, side, qty, price)
        risk.open_position(symbol, side, qty, price)
        logger.info(f"ORDER: {side} executed for {qty} {symbol} @ {price}")

    return res

@app.websocket("/ws/market_stream")
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """Handles frontend terminal connections via the unified broadcaster."""
    await broadcaster.connect(websocket)
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
    except Exception as e:
        logger.error("WS: Client connection error: %s", e.__class__.__name__)
        broadcaster.disconnect(websocket)

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
