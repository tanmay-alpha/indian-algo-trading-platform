import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import time
import pyotp
import threading
import logging
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2
from backend.core.config import settings
from backend.gateway.instrument_registry import get_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

api_key = settings.angel_api_key
client_id = settings.angel_client_code
password = settings.angel_password
totp_secret = settings.angel_totp_secret

if not all([api_key, client_id, password, totp_secret]):
    logger.error("Missing ENV variables")
    exit(1)

# 2. LOGIN
smart = SmartConnect(api_key=api_key)

def get_totp(secret):
    clean_secret = secret.replace(" ", "").upper()
    return pyotp.TOTP(clean_secret).now()

logger.info("Attempting login...")
try:
    totp = get_totp(totp_secret)
    data = smart.generateSession(client_id, password, totp)
    if not data or not data.get("status"):
        logger.error("Login failed. Response status unavailable or false.")
        # Try time drift compensation
        logger.info("Retrying with -30s drift...")
        time.sleep(1)
        totp = get_totp(totp_secret)
        data = smart.generateSession(client_id, password, totp)
        if not data or not data.get("status"):
            logger.error("Login failed completely.")
            exit(1)
except Exception as e:
    logger.error("Login exception: %s", e.__class__.__name__)
    exit(1)

# 3. EXTRACTION
logger.info(
    "Login Response: status=%s message_present=%s",
    bool(data.get("status")) if isinstance(data, dict) else False,
    bool(data.get("message")) if isinstance(data, dict) else False,
)
jwt_token = data.get("data", {}).get("jwtToken")
feed_token = smart.getfeedToken()

if not jwt_token or not feed_token:
    logger.error("Missing tokens")
    exit(1)

logger.info("Tokens received successfully.")

# 4. WEBSOCKET
ticks_received = 0

def on_data(ws, message):
    global ticks_received
    ticks_received += 1
    logger.info("Tick received. Count=%s", ticks_received)

def on_open(ws):
    logger.info("WS Opened. Subscribing...")
    symbol_token = get_token("SBIN")
    if not symbol_token:
        logger.error("WS subscribe skipped: symbol token unavailable")
        return
    tokens = [{"exchangeType": 1, "tokens": [symbol_token]}]
    sws.subscribe(
        correlation_id="stream0001",
        mode=3,
        token_list=tokens
    )

def on_error(ws, error):
    logger.error("WS Error: %s", error.__class__.__name__)  # SECURITY: redacted

def on_close(ws, close_status_code, close_msg):
    logger.warning("WS Closed: %s message_present=%s", close_status_code, bool(close_msg))  # SECURITY: redacted

sws = SmartWebSocketV2(jwt_token, api_key, client_id, feed_token)
sws.on_open = on_open
sws.on_data = on_data
sws.on_error = on_error
sws.on_close = on_close

logger.info("Starting WS thread...")
ws_thread = threading.Thread(target=sws.connect, daemon=True)
ws_thread.start()

# 5. WAIT AND VERIFY
time.sleep(10)
logger.info("Test finished. Ticks received: %s", ticks_received)
if ticks_received > 0:
    logger.info("SUCCESS")
else:
    logger.error("FAILED to receive ticks")
