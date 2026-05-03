import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import ntplib
import pyotp
from loguru import logger
from SmartApi import SmartConnect

from backend.core.config import settings


class SessionManager:
    def __init__(self):
        self._smart_api: Optional[Any] = None
        self._auth_token: Optional[str] = None
        self._feed_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._session_valid = False
        self._last_refresh: Optional[datetime] = None
        self._last_error: Optional[str] = None

    @property
    def smart_api(self) -> Optional[Any]:
        return self._smart_api

    @property
    def auth_token(self) -> Optional[str]:
        return self._auth_token

    @property
    def feed_token(self) -> Optional[str]:
        return self._feed_token

    @property
    def refresh_token(self) -> Optional[str]:
        return self._refresh_token

    @property
    def is_valid(self) -> bool:
        return self._session_valid

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    @property
    def status(self) -> dict:
        return {
            "is_valid": self._session_valid,
            "auth_token_available": bool(self._auth_token),
            "feed_token_available": bool(self._feed_token),
            "refresh_token_available": bool(self._refresh_token),
            "last_refresh": self._last_refresh.isoformat() if self._last_refresh else None,
            "last_error": self._last_error,
        }

    async def initialize(self) -> bool:
        """
        Full login sequence.
        Must not crash application.
        Returns True on success, False on failure.
        Must never log credential/token values.
        """
        try:
            response = await asyncio.to_thread(self._login_sync)
            if self._apply_session_response(response):
                self._session_valid = True
                self._last_refresh = datetime.now(timezone.utc)
                self._last_error = None
                logger.info("Session initialized successfully")
                return True

            self._mark_invalid(self._classify_login_failure(response))
            return False
        except Exception as exc:
            reason = self._network_error_reason(exc)
            self._mark_invalid(reason)
            logger.error(reason)
            return False

    async def refresh(self) -> bool:
        """
        Refresh JWT/session if possible.
        If refresh fails, attempt full re-login once.
        Returns True if session is valid after refresh/recovery.
        """
        try:
            response = await asyncio.to_thread(self._refresh_sync)
            if self._apply_session_response(response):
                self._session_valid = True
                self._last_refresh = datetime.now(timezone.utc)
                self._last_error = None
                logger.info("Session refreshed successfully")
                return True

            logger.warning("Session refresh failed; attempting re-login")
        except Exception as exc:
            logger.warning(f"Session refresh error: {exc.__class__.__name__}; attempting re-login")

        return await self.initialize()

    def check_clock_drift(self) -> float:
        """
        Query NTP server pool.ntp.org using ntplib.
        Return absolute drift in seconds.
        Raise RuntimeError if drift > 30 seconds.
        Log warning if drift > 10 seconds.
        Never log credentials.
        """
        client = ntplib.NTPClient()
        response = client.request("pool.ntp.org", version=3)
        drift = abs(float(response.offset))

        if drift > 30:
            logger.error("System clock drift exceeds 30 seconds")
            raise RuntimeError("System clock drift exceeds 30 seconds")

        if drift > 10:
            logger.warning("System clock drift exceeds 10 seconds")

        return drift

    def _login_sync(self) -> Any:
        smart_api = SmartConnect(api_key=settings.angel_api_key)
        totp = pyotp.TOTP(settings.angel_totp_secret).now()
        response = smart_api.generateSession(
            settings.angel_client_code,
            settings.angel_password,
            totp,
        )
        self._smart_api = smart_api
        return response

    def _refresh_sync(self) -> Any:
        if not self._smart_api or not self._refresh_token:
            return None

        refresh_method = getattr(self._smart_api, "generateToken", None)
        if not refresh_method:
            return None

        return refresh_method(self._refresh_token)

    def _apply_session_response(self, response: Any) -> bool:
        if not isinstance(response, dict):
            return False

        data = response.get("data") if isinstance(response.get("data"), dict) else {}
        auth_token = (
            data.get("jwtToken")
            or data.get("authToken")
            or data.get("accessToken")
            or response.get("jwtToken")
            or response.get("authToken")
            or response.get("accessToken")
        )
        refresh_token = data.get("refreshToken") or response.get("refreshToken")
        feed_token = data.get("feedToken") or response.get("feedToken")

        if not feed_token and self._smart_api:
            get_feed_token = getattr(self._smart_api, "getfeedToken", None)
            if get_feed_token:
                feed_token = get_feed_token()

        status_ok = response.get("status") is True or bool(auth_token)
        if not status_ok or not auth_token:
            return False

        self._auth_token = auth_token
        self._refresh_token = refresh_token or self._refresh_token
        self._feed_token = feed_token or self._feed_token
        return bool(self._auth_token and self._feed_token)

    def _classify_login_failure(self, response: Any) -> str:
        message = ""
        if isinstance(response, dict):
            message = str(response.get("message") or response.get("error") or "")

        lowered = message.lower()
        if "totp" in lowered:
            reason = "TOTP validation failed - check system clock"
            logger.error(reason)
            return reason

        if any(term in lowered for term in ("auth", "credential", "password", "client", "invalid")):
            reason = "Authentication failed - check environment configuration"
            logger.error(reason)
            return reason

        reason = "Login failed"
        logger.error(reason)
        return reason

    def _network_error_reason(self, exc: Exception) -> str:
        return f"Login network error: {exc.__class__.__name__}"

    def _mark_invalid(self, reason: str) -> None:
        self._session_valid = False
        self._last_error = reason
