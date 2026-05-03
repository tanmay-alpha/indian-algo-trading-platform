import os
import time
import pyotp
import logging
from dotenv import load_dotenv
from SmartApi import SmartConnect

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

class AngelSession:
    def __init__(self):
        self.api_key = os.getenv("ANGEL_API_KEY")
        self.client_id = os.getenv("ANGEL_CLIENT_ID")
        self.password = os.getenv("ANGEL_PASSWORD")
        self.totp_secret = os.getenv("ANGEL_TOTP_SECRET")

        if not all([self.api_key, self.client_id, self.password, self.totp_secret]):
            raise ValueError("CRITICAL: Missing Angel One environment variables in .env")

        self.smart = None
        self.jwt_token = None
        self.refresh_token = None
        self.feed_token = None

    def _get_totp(self):
        clean_secret = self.totp_secret.replace(" ", "").upper()
        return pyotp.TOTP(clean_secret).now()

    def login(self):
        logger.info("SESSION: Initializing Angel Session...")
        self.smart = SmartConnect(api_key=self.api_key)

        totp = self._get_totp()
        data = self.smart.generateSession(self.client_id, self.password, totp)
        
        # Handle time drift retry
        if not data or not data.get("status"):
            logger.warning(f"SESSION: Login failed, possible TOTP time drift. Retrying... Response: {data}")
            time.sleep(1) # Wait for potential window rollover
            totp = self._get_totp()
            data = self.smart.generateSession(self.client_id, self.password, totp)
            
            if not data or not data.get("status"):
                error_msg = data.get("message", "Unknown error") if data else "Empty response"
                if "Invalid TOTP" in error_msg:
                    raise Exception(f"Login failed: Invalid TOTP. Check PC time sync! Response: {data}")
                else:
                    raise Exception(f"Login failed: Check Credentials. Response: {data}")

        logger.info(f"SESSION: Structured Login Response: {{'status': {data.get('status')}, 'message': '{data.get('message')}'}}")

        self.jwt_token = data.get("data", {}).get("jwtToken")
        self.refresh_token = data.get("data", {}).get("refreshToken")
        self.feed_token = self.smart.getfeedToken()

        if not self.jwt_token or not self.feed_token:
            raise ValueError("CRITICAL: Login succeeded but jwtToken or feedToken is missing.")

        logger.info("SESSION: Angel Session Active. Tokens successfully extracted.")
        return self

    def get_smart(self):
        if not self.smart:
            self.login()
        return self.smart