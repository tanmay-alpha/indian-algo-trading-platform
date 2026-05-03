# backend/api_server.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging

from backend.gateway.market_gateway import MarketDataGateway
from backend.execution.execution_router import ExecutionRouter
from backend.portfolio.portfolio_manager import PortfolioManager
from backend.risk.risk_manager import RiskManager
from backend.engine.strategy_engine import StrategyEngine
from backend.core.broadcaster import WebSocketBroadcaster
from backend.core.session import AngelSession

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

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Components ---
broadcaster = WebSocketBroadcaster()
gateway = None
portfolio = PortfolioManager(initial_capital=50000)
risk = RiskManager(initial_capital=50000)
strategy = StrategyEngine()

auto_pilot = False
last_trade_time = 0
trade_cooldown = 60 # 60 seconds safety cooldown

execution_mode = "PAPER"
router = ExecutionRouter(mode=execution_mode)

broker_status = {
    "configured": AngelSession.config_status()["configured"],
    "logged_in": False,
    "feed_token_available": False,
    "websocket_started": False,
    "last_error": None,
}

def get_broker_status():
    if gateway:
        broker_status.update(gateway.status)
    return broker_status.copy()

def start_gateway(loop):
    """Create and start broker connectivity without crashing the app."""
    global gateway
    try:
        if gateway is None:
            gateway = MarketDataGateway(broadcaster=broadcaster, loop=loop)
            gateway.on_tick_received = lambda t: asyncio.run_coroutine_threadsafe(process_tick(t), loop)

        started = gateway.start()
        broker_status.update(gateway.status)
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
    await asyncio.to_thread(start_gateway, loop)

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
    await broadcaster.broadcast(tick)

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
        "portfolio": portfolio.get_performance()
    }

@app.post("/toggle_mode")
def toggle_mode(mode: str):
    global execution_mode, router
    if mode not in ["PAPER", "LIVE"]:
        raise HTTPException(status_code=400, detail="Invalid mode")

    if mode == "LIVE":
        broker = get_broker_status()
        if not gateway or not gateway.session or not broker["logged_in"]:
            raise HTTPException(status_code=503, detail="Broker session is not initialized")
    
    execution_mode = mode
    router = ExecutionRouter(mode=execution_mode, session=gateway.session if gateway else None)
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

    price = price_data["price"]

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

@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """Handles frontend terminal connections via the unified broadcaster."""
    await broadcaster.connect(websocket)
    try:
        while True:
            # Keep connection alive; messages are pushed by the broadcaster
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception as e:
        logger.error(f"WS: Error on client connection: {e}")
        broadcaster.disconnect(websocket)
