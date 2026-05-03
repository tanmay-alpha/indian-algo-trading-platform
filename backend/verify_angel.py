import os
import time
import pyotp
import threading
import logging
from dotenv import load_dotenv
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# 1. LOAD ENV
load_dotenv(override=True)

api_key = os.getenv("ANGEL_API_KEY")
client_id = os.getenv("ANGEL_CLIENT_ID")
password = os.getenv("ANGEL_PASSWORD")
totp_secret = os.getenv("ANGEL_TOTP_SECRET")

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
        logger.error(f"Login failed. Response: {data}")
        # Try time drift compensation
        logger.info("Retrying with -30s drift...")
        time.sleep(1)
        totp = get_totp(totp_secret)
        data = smart.generateSession(client_id, password, totp)
        if not data or not data.get("status"):
            logger.error("Login failed completely.")
            exit(1)
except Exception as e:
    logger.error(f"Login exception: {e}")
    exit(1)

# 3. EXTRACTION
logger.info(f"Login Response: {data}")
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
    logger.info(f"Tick received: {message}")

def on_open(ws):
    logger.info("WS Opened. Subscribing...")
    tokens = [{"exchangeType": 1, "tokens": ["3045"]}] # SBIN-EQ
    sws.subscribe(
        correlation_id="stream0001",
        mode=3,
        token_list=tokens
    )

def on_error(ws, error):
    logger.error(f"WS Error: {error}")

def on_close(ws, close_status_code, close_msg):
    logger.warning(f"WS Closed: {close_status_code} - {close_msg}")

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
logger.info(f"Test finished. Ticks received: {ticks_received}")
if ticks_received > 0:
    logger.info("SUCCESS")
else:
    logger.error("FAILED to receive ticks")
