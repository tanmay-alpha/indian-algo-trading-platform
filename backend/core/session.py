import time
import pyotp
import logging
from SmartApi import SmartConnect
from backend.core.config import settings

logger = logging.getLogger(__name__)

class AngelSession:
    @staticmethod
    def config_status():
        """Return broker config presence without exposing values."""
        return {
            "configured": all([
                settings.angel_api_key,
                settings.angel_client_code,
                settings.angel_password,
                settings.angel_totp_secret,
            ]),
            "missing": [],
        }

    def __init__(self):
        self.api_key = settings.angel_api_key
        self.client_id = settings.angel_client_code
        self.password = settings.angel_password
        self.totp_secret = settings.angel_totp_secret

        if not all([self.api_key, self.client_id, self.password, self.totp_secret]):
            missing = AngelSession.config_status()["missing"]
            raise ValueError(f"Missing Angel One environment variables: {', '.join(missing)}")

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
            logger.warning("SESSION: Login failed, possible clock drift. Retrying...")
            time.sleep(1) # Wait for potential window rollover
            totp = self._get_totp()
            data = self.smart.generateSession(self.client_id, self.password, totp)
            
            if not data or not data.get("status"):
                error_msg = data.get("message", "Unknown error") if data else "Empty response"
                if "Invalid TOTP" in error_msg:
                    raise Exception("Login failed: one-time code rejected. Check PC time sync.")
                else:
                    raise Exception(f"Login failed: {error_msg}")

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
