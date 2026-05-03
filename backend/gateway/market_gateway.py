import threading
import logging
from SmartApi.smartWebSocketV2 import SmartWebSocketV2
from backend.core.session import AngelSession

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def safe_error_message(error):
    message = str(error) or error.__class__.__name__
    sensitive_terms = ("api_key", "password", "secret", "jwt", "refresh", "feed", "token")
    if any(term in message.lower() for term in sensitive_terms):
        return error.__class__.__name__
    return message

class MarketDataGateway:
    """
    Live Market Data Gateway (MDG) for Angel One SmartAPI.
    Funnels live ticks into the system without blocking.
    """
    def __init__(self, broadcaster=None, loop=None):
        logger.info("GATEWAY: Market Data Gateway created.")

        self.session = None
        self.api_key = None
        self.client_code = None
        self.jwt_token = None
        self.feed_token = None

        self.broadcaster = broadcaster
        self.loop = loop

        # Subscriptions setup (MUST be string tokens)
        self.subscriptions = {
            "3045": "SBIN-EQ",
            "2885": "RELIANCE-EQ",
            "1594": "INFY-EQ"
        }
        
        self.on_tick_received = None
        self.latest_data = {}
        self.sws = None
        self.ws_thread = None
        self.status = {
            "configured": AngelSession.config_status()["configured"],
            "logged_in": False,
            "feed_token_available": False,
            "websocket_started": False,
            "last_error": None,
        }

    def initialize_session(self):
        """Login to Angel only when explicitly requested."""
        config = AngelSession.config_status()
        self.status["configured"] = config["configured"]
        self.status["last_error"] = None

        if not config["configured"]:
            self.status["last_error"] = f"Missing broker config: {', '.join(config['missing'])}"
            logger.warning("MDG: Broker configuration is incomplete; market stream will not start.")
            return False

        try:
            self.session = AngelSession().login()
            self.api_key = self.session.api_key
            self.client_code = self.session.client_id
            self.jwt_token = self.session.jwt_token
            self.feed_token = self.session.feed_token
            self.status["logged_in"] = True
            self.status["feed_token_available"] = bool(self.feed_token)
            return True
        except Exception as e:
            self.status["logged_in"] = False
            self.status["feed_token_available"] = False
            self.status["websocket_started"] = False
            self.status["last_error"] = safe_error_message(e)
            logger.error(f"MDG: Broker login failed: {self.status['last_error']}")
            return False

    def on_data(self, ws, message):
        """Callback for incoming WebSocket data."""
        try:
            if not isinstance(message, dict) or "data" not in message:
                return

            ticks = message["data"]
            for tick in ticks:
                token = tick.get("token")
                symbol = self.subscriptions.get(token, "UNKNOWN")
                
                ltp = float(tick.get("last_traded_price", 0)) / 100
                vvwap = float(tick.get("avg_traded_price", 0)) / 100
                volume = int(tick.get("vol_traded_today", 0))
                
                best_bid = float(tick.get("best_bid_price", 0)) / 100
                best_ask = float(tick.get("best_ask_price", 0)) / 100
                
                if ltp == 0: continue

                payload = {
                    "type": "TICK",
                    "symbol": symbol,
                    "token": token,
                    "price": ltp,
                    "vwap": vvwap,
                    "volume": volume,
                    "best_bid": best_bid,
                    "best_ask": best_ask,
                    "timestamp": tick.get("exchange_timestamp", "")
                }
                
                self.latest_data[token] = payload
                
                # Clearly print the tick
                logger.info(f"Tick: {{'symbol': '{symbol}', 'last_traded_price': {ltp}, 'vwap': {vvwap}}}")

                # Dispatch to Processing Callback
                if self.on_tick_received:
                    self.on_tick_received(payload)

        except Exception as e:
            logger.error(f"MDG: SnapQuote Data parsing error: {e}")

    def on_open(self, ws):
        logger.info(f"MDG: WS Connected. Subscribing to tokens: {list(self.subscriptions.keys())}")
        
        # Format MUST strictly be strings for tokens
        tokens = [{
            "exchangeType": 1, # NSE_CM
            "tokens": list(self.subscriptions.keys())
        }]

        # CRITICAL FIX: correlation_id MUST be exactly 10 alphanumeric chars
        self.sws.subscribe(
            correlation_id="stream0001",
            mode=3, # Mode 3 = SnapQuote
            token_list=tokens
        )

    def on_error(self, ws, error):
        self.status["last_error"] = "WebSocket error"
        logger.error("MDG: WebSocket Error")

    # CRITICAL FIX: on_close signature takes 3 args in modern websocket-client
    def on_close(self, ws, close_status_code, close_msg):
        self.status["websocket_started"] = False
        logger.warning(f"MDG: Connection closed. Code: {close_status_code}")

    def start(self):
        """Initializes and connects the SmartWebSocketV2 non-blockingly."""
        try:
            if not self.session and not self.initialize_session():
                return False

            self.sws = SmartWebSocketV2(
                self.jwt_token,
                self.api_key,
                self.client_code,
                self.feed_token
            )

            self.sws.on_open = self.on_open
            self.sws.on_data = self.on_data
            self.sws.on_error = self.on_error
            self.sws.on_close = self.on_close
            
            logger.info("MDG: Launching WebSocket Stream in background thread...")
            
            # CRITICAL FIX: Run in daemon thread to prevent freezing main process
            self.ws_thread = threading.Thread(target=self.sws.connect, daemon=True)
            self.ws_thread.start()
            self.status["websocket_started"] = True
            self.status["last_error"] = None
            return True
            
        except Exception as e:
            self.status["websocket_started"] = False
            self.status["last_error"] = safe_error_message(e)
            logger.error(f"MDG Fatal Startup Error: {self.status['last_error']}")
            return False
