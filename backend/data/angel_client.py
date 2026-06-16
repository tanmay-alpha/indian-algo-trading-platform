"""Angel One SmartAPI client for live ticks during market hours.

Login is cached for 5 hours via a module-level singleton session, with TOTP
regenerated at every login (and on expiry). The four required env vars are:

  * ``ANGEL_API_KEY``     — issued by SmartAPI dashboard
  * ``ANGEL_CLIENT_ID``   — your Angel One client code
  * ``ANGEL_PASSWORD``    — your PIN
  * ``ANGEL_TOTP_SECRET`` — the TOTP secret string (NOT a one-time code)

If any are missing ``is_configured()`` returns False and ``get_quote`` /
``get_candle_data`` return ``None`` / ``[]`` cleanly. The market_data
service treats this as "use Yahoo" and keeps working.
"""
import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

_session = None
_session_time = None
SESSION_TTL_SECONDS = 5 * 3600  # 5 hours

# internal → Angel One's interval names
INTERVAL_MAP = {
    "1m": "ONE_MINUTE",
    "5m": "FIVE_MINUTE",
    "15m": "FIFTEEN_MINUTE",
    "1h": "ONE_HOUR",
    "1D": "ONE_DAY",
}


def _login():
    """Login to Angel One SmartAPI with TOTP. Cached for 5 hours."""
    global _session, _session_time

    api_key = os.environ.get("ANGEL_API_KEY", "").strip()
    client_id = os.environ.get("ANGEL_CLIENT_ID", "").strip()
    password = os.environ.get("ANGEL_PASSWORD", "").strip()
    totp_secret = os.environ.get("ANGEL_TOTP_SECRET", "").strip()

    if not all([api_key, client_id, password, totp_secret]):
        logger.warning("[angel] Credentials not configured; live data unavailable")
        return None

    # Reuse session if still valid
    if _session and _session_time:
        age = (datetime.now() - _session_time).total_seconds()
        if age < SESSION_TTL_SECONDS:
            return _session

    try:
        from SmartApi import SmartConnect
        import pyotp

        _session = SmartConnect(api_key=api_key)
        totp = pyotp.TOTP(totp_secret).now()
        data = _session.generateSession(
            client_code=client_id, password=password, totp=totp
        )
        if data and data.get("status"):
            _session_time = datetime.now()
            logger.info(f"[angel] Logged in as {client_id}")
            return _session
        else:
            logger.error(f"[angel] Login failed: {data}")
            return None
    except Exception as e:
        logger.error(f"[angel] Login error: {e}")
        return None


def is_configured() -> bool:
    """Check if Angel One credentials are available."""
    return all([
        os.environ.get("ANGEL_API_KEY", "").strip(),
        os.environ.get("ANGEL_CLIENT_ID", "").strip(),
        os.environ.get("ANGEL_PASSWORD", "").strip(),
        os.environ.get("ANGEL_TOTP_SECRET", "").strip(),
    ])


def get_quote(symbol: str, token: str, exchange: str = "NSE") -> Optional[dict]:
    """Get live LTP from Angel One. Requires symbol token from instrument list."""
    obj = _login()
    if not obj:
        return None
    try:
        data = obj.ltpData(exchange, symbol, token)
        if data and data.get("data"):
            d = data["data"]
            ltp = float(d.get("ltp", 0))
            prev_close = float(d.get("close", 0))
            change = float(d.get("change", 0)) if d.get("change") else (
                ltp - prev_close if prev_close else 0
            )
            change_pct = (
                (change / prev_close * 100) if prev_close else 0
            )
            return {
                "symbol": symbol,
                "exchange": exchange,
                "ltp": ltp,
                "open": float(d.get("open", ltp)),
                "high": float(d.get("high", ltp)),
                "low": float(d.get("low", ltp)),
                "close": prev_close,
                "change": round(change, 2),
                "changePct": round(change_pct, 2),
                "volume": int(d.get("volume", 0)),
                "source": "angel",
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"[angel] get_quote failed for {symbol}: {e}")
    return None


def get_candle_data(
    symbol: str,
    token: str,
    exchange: str,
    interval: str,
    from_date: str,
    to_date: str,
) -> list:
    """Fetch intraday candles from Angel One.

    ``from_date`` / ``to_date`` are ``'YYYY-MM-DD HH:MM'`` strings.
    The returned list mirrors the format of ``yahoo_client.fetch_history``
    so the unified service can blend them seamlessly.
    """
    obj = _login()
    if not obj:
        return []
    try:
        angel_interval = INTERVAL_MAP.get(interval, "ONE_DAY")
        params = {
            "exchange": exchange,
            "symboltoken": token,
            "interval": angel_interval,
            "fromdate": from_date,
            "todate": to_date,
        }
        data = obj.getCandleData(params)
        if data and data.get("data"):
            out = []
            for c in data["data"]:
                # c = [time, open, high, low, close, volume]
                out.append({
                    "time": int(
                        datetime.strptime(
                            c[0], "%Y-%m-%dT%H:%M:%S%z"
                        ).timestamp()
                    ),
                    "open": float(c[1]),
                    "high": float(c[2]),
                    "low": float(c[3]),
                    "close": float(c[4]),
                    "volume": int(c[5]),
                })
            return out
    except Exception as e:
        logger.error(f"[angel] get_candle_data failed for {symbol}: {e}")
    return []
