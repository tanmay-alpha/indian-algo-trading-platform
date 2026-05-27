# backend/services/broker_account_sync.py
"""
BrokerAccountSyncService — Phase 22A

Read-only broker account sync using Angel One SmartAPI.

ABSOLUTE SAFETY RULES:
- Never place, cancel, or modify orders.
- Never print tokens, credentials, or raw broker error text.
- Return BROKER_SESSION_UNAVAILABLE if session is not available.
- Sanitize all outputs before returning.
- Safe import — no session created at module load time.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

_SAFE_STATUS = ("OK", "BROKER_SESSION_UNAVAILABLE", "BROKER_ERROR")
_SOURCE = "angel_one_read_only"

# Fields that must NEVER appear in sanitized output
_BLOCKED_KEYS = frozenset({
    "jwtToken", "jwt_token", "authToken", "auth_token",
    "refreshToken", "refresh_token", "feedToken", "feed_token",
    "password", "totp", "apiKey", "api_key", "clientCode",
    "token", "secret", "credential",
})


def _sanitize_record(record: Any) -> Any:
    """Recursively remove sensitive fields from a dict/list structure."""
    if isinstance(record, dict):
        return {
            k: _sanitize_record(v)
            for k, v in record.items()
            if k not in _BLOCKED_KEYS
        }
    if isinstance(record, list):
        return [_sanitize_record(item) for item in record]
    return record


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _unavailable_response(reason: str = "BROKER_SESSION_UNAVAILABLE") -> dict:
    """Return a safe, structured response when broker is not available."""
    return {
        "status": reason,
        "holdings": [],
        "positions": [],
        "funds": {},
        "orders": [],
        "trades": [],
        "synced_at": _utc_now(),
        "source": _SOURCE,
    }


class BrokerAccountSyncService:
    """
    Read-only sync service for Angel One broker account data.

    Pass `session_manager` from app.state at call time.
    Never stores credentials. Never places orders.
    """

    def __init__(self, session_manager=None):
        self._sm = session_manager

    def _get_smart_api(self):
        """Return the SmartConnect instance if the session is valid, else None."""
        sm = self._sm
        if sm is None:
            return None
        if not getattr(sm, "is_valid", False):
            return None
        smart = getattr(sm, "smart_api", None)
        if smart is None:
            return None
        return smart

    def _is_available(self) -> bool:
        return self._get_smart_api() is not None

    # ------------------------------------------------------------------
    # Individual account data methods
    # ------------------------------------------------------------------

    def get_holdings(self) -> dict:
        """Fetch equity holdings from broker. Read-only."""
        smart = self._get_smart_api()
        if smart is None:
            return {"status": "BROKER_SESSION_UNAVAILABLE", "holdings": [], "source": _SOURCE}
        try:
            resp = smart.holding()
            data = resp.get("data") or [] if isinstance(resp, dict) else []
            holdings = _sanitize_record(data if isinstance(data, list) else [])
            normalized = [_normalize_holding(h) for h in holdings]
            return {"status": "OK", "holdings": normalized, "source": _SOURCE}
        except Exception as exc:
            logger.warning("BrokerSync: get_holdings failed: %s", exc.__class__.__name__)
            return {"status": "BROKER_ERROR", "holdings": [], "source": _SOURCE}

    def get_positions(self) -> dict:
        """Fetch open positions from broker. Read-only."""
        smart = self._get_smart_api()
        if smart is None:
            return {"status": "BROKER_SESSION_UNAVAILABLE", "positions": [], "source": _SOURCE}
        try:
            resp = smart.position()
            data = resp.get("data") or [] if isinstance(resp, dict) else []
            positions = _sanitize_record(data if isinstance(data, list) else [])
            normalized = [_normalize_position(p) for p in positions]
            return {"status": "OK", "positions": normalized, "source": _SOURCE}
        except Exception as exc:
            logger.warning("BrokerSync: get_positions failed: %s", exc.__class__.__name__)
            return {"status": "BROKER_ERROR", "positions": [], "source": _SOURCE}

    def get_funds(self) -> dict:
        """Fetch funds/margin data from broker. Read-only."""
        smart = self._get_smart_api()
        if smart is None:
            return {"status": "BROKER_SESSION_UNAVAILABLE", "funds": {}, "source": _SOURCE}
        try:
            resp = smart.rmsLimit()
            data = resp.get("data") or {} if isinstance(resp, dict) else {}
            funds = _sanitize_record(data if isinstance(data, dict) else {})
            normalized = _normalize_funds(funds)
            return {"status": "OK", "funds": normalized, "source": _SOURCE}
        except Exception as exc:
            logger.warning("BrokerSync: get_funds failed: %s", exc.__class__.__name__)
            return {"status": "BROKER_ERROR", "funds": {}, "source": _SOURCE}

    def get_order_book(self) -> dict:
        """Fetch order book (read-only view of placed orders). No mutations."""
        smart = self._get_smart_api()
        if smart is None:
            return {"status": "BROKER_SESSION_UNAVAILABLE", "orders": [], "source": _SOURCE}
        try:
            resp = smart.orderBook()
            data = resp.get("data") or [] if isinstance(resp, dict) else []
            orders = _sanitize_record(data if isinstance(data, list) else [])
            normalized = [_normalize_order(o) for o in orders]
            return {"status": "OK", "orders": normalized, "source": _SOURCE}
        except Exception as exc:
            logger.warning("BrokerSync: get_order_book failed: %s", exc.__class__.__name__)
            return {"status": "BROKER_ERROR", "orders": [], "source": _SOURCE}

    def get_trade_book(self) -> dict:
        """Fetch trade book (executed trades, read-only)."""
        smart = self._get_smart_api()
        if smart is None:
            return {"status": "BROKER_SESSION_UNAVAILABLE", "trades": [], "source": _SOURCE}
        try:
            resp = smart.tradeBook()
            data = resp.get("data") or [] if isinstance(resp, dict) else []
            trades = _sanitize_record(data if isinstance(data, list) else [])
            normalized = [_normalize_trade(t) for t in trades]
            return {"status": "OK", "trades": normalized, "source": _SOURCE}
        except Exception as exc:
            logger.warning("BrokerSync: get_trade_book failed: %s", exc.__class__.__name__)
            return {"status": "BROKER_ERROR", "trades": [], "source": _SOURCE}

    def get_account_snapshot(self) -> dict:
        """Return a combined read-only snapshot of all account sections."""
        if not self._is_available():
            return _unavailable_response("BROKER_SESSION_UNAVAILABLE")
        holdings_result = self.get_holdings()
        positions_result = self.get_positions()
        funds_result = self.get_funds()
        orders_result = self.get_order_book()
        trades_result = self.get_trade_book()

        # Determine overall status
        statuses = [
            holdings_result.get("status"),
            positions_result.get("status"),
            funds_result.get("status"),
            orders_result.get("status"),
            trades_result.get("status"),
        ]
        any_error = any(s == "BROKER_ERROR" for s in statuses)
        overall = "BROKER_ERROR" if any_error else "OK"

        return {
            "status": overall,
            "holdings": holdings_result.get("holdings", []),
            "positions": positions_result.get("positions", []),
            "funds": funds_result.get("funds", {}),
            "orders": orders_result.get("orders", []),
            "trades": trades_result.get("trades", []),
            "synced_at": _utc_now(),
            "source": _SOURCE,
        }

    def sync_all_read_only(self) -> dict:
        """Alias for get_account_snapshot — safe read-only sync entry point."""
        return self.get_account_snapshot()


# ------------------------------------------------------------------
# Field normalizers — only safe display fields are kept
# ------------------------------------------------------------------

def _safe_float(value) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (ValueError, TypeError):
        return None


def _safe_str(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


def _normalize_holding(raw: dict) -> dict:
    return {
        "symbol": _safe_str(raw.get("tradingsymbol") or raw.get("symbol")),
        "isin": _safe_str(raw.get("isin")),
        "quantity": _safe_float(raw.get("quantity") or raw.get("qty")),
        "avg_price": _safe_float(raw.get("averageprice") or raw.get("avg_price")),
        "ltp": _safe_float(raw.get("ltp")),
        "realised_quantity": _safe_float(raw.get("realisedquantity")),
        "product": _safe_str(raw.get("product")),
        "exchange": _safe_str(raw.get("exchange")),
    }


def _first_not_none(raw: dict, *keys):
    """Return the value of the first key that is not None (including 0/0.0/False)."""
    for k in keys:
        v = raw.get(k)
        if v is not None:
            return v
    return None


def _normalize_position(raw: dict) -> dict:
    return {
        "symbol": _safe_str(_first_not_none(raw, "tradingsymbol", "symbol")),
        "product": _safe_str(raw.get("product")),
        "exchange": _safe_str(raw.get("exchange")),
        "net_qty": _safe_float(_first_not_none(raw, "netqty", "net_qty")),
        "avg_price": _safe_float(_first_not_none(raw, "averageprice", "avg_price")),
        "ltp": _safe_float(raw.get("ltp")),
        "unrealised_pnl": _safe_float(_first_not_none(raw, "unrealisedpnl", "unrealized_pnl")),
        "realised_pnl": _safe_float(_first_not_none(raw, "realisedpnl", "realized_pnl")),
    }


def _normalize_funds(raw: dict) -> dict:
    return {
        "available_cash": _safe_float(raw.get("availablecash") or raw.get("available_cash")),
        "net": _safe_float(raw.get("net")),
        "used_margin": _safe_float(raw.get("utiliseddebits") or raw.get("used_margin")),
        "available_intraday_payin": _safe_float(raw.get("availableintradaypayin")),
        "collateral": _safe_float(raw.get("collateral")),
        "m2mrealized": _safe_float(raw.get("m2mrealized")),
        "m2munrealized": _safe_float(raw.get("m2munrealized")),
    }


def _normalize_order(raw: dict) -> dict:
    """Safe order record — no secrets. Mask full order IDs."""
    order_id = _safe_str(raw.get("orderid") or raw.get("order_id"))
    masked_id = order_id[-6:] if order_id else ""
    return {
        "order_id_masked": f"...{masked_id}" if masked_id else "N/A",
        "symbol": _safe_str(raw.get("tradingsymbol") or raw.get("symbol")),
        "side": _safe_str(raw.get("transactiontype") or raw.get("side")),
        "quantity": _safe_float(raw.get("quantity") or raw.get("qty")),
        "price": _safe_float(raw.get("price")),
        "status": _safe_str(raw.get("status") or raw.get("orderstatus")),
        "product": _safe_str(raw.get("product")),
        "exchange": _safe_str(raw.get("exchange")),
        "order_type": _safe_str(raw.get("ordertype") or raw.get("order_type")),
        "order_time": _safe_str(raw.get("updatetime") or raw.get("order_time")),
    }


def _normalize_trade(raw: dict) -> dict:
    """Safe trade record — no secrets. Mask full trade IDs."""
    trade_id = _safe_str(raw.get("tradeid") or raw.get("trade_id"))
    masked_id = trade_id[-6:] if trade_id else ""
    return {
        "trade_id_masked": f"...{masked_id}" if masked_id else "N/A",
        "symbol": _safe_str(raw.get("tradingsymbol") or raw.get("symbol")),
        "side": _safe_str(raw.get("transactiontype") or raw.get("side")),
        "quantity": _safe_float(raw.get("quantity") or raw.get("qty")),
        "price": _safe_float(raw.get("tradeprice") or raw.get("trade_price") or raw.get("price")),
        "product": _safe_str(raw.get("product")),
        "exchange": _safe_str(raw.get("exchange")),
        "trade_time": _safe_str(raw.get("updatetime") or raw.get("trade_time")),
    }
