# backend/routers/broker_account.py
"""
Broker Account API Router — Phase 22A

READ-ONLY broker account sync endpoints.

ABSOLUTE SAFETY:
- No order placement, cancel, or modify.
- No live mutation APIs.
- Session unavailable → safe BROKER_SESSION_UNAVAILABLE response.
- All responses sanitized.
- Admin token required for all private data endpoints.
"""

import logging
from fastapi import APIRouter, Depends, Request

from backend.core.security import require_admin_token, sanitize_response
from backend.services.broker_account_sync import BrokerAccountSyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/broker/account", tags=["broker-account"])


def _get_sync_service(request: Request) -> BrokerAccountSyncService:
    """Create a BrokerAccountSyncService using session_manager from app.state."""
    sm = getattr(request.app.state, "session_manager", None)
    return BrokerAccountSyncService(session_manager=sm)


# ------------------------------------------------------------------
# Public — session status only (no private data)
# ------------------------------------------------------------------

@router.get("/status")
def get_broker_account_status(request: Request):
    """
    Return broker session status (no private data, safe to expose).
    session_manager.status contains only boolean availability flags.
    """
    sm = getattr(request.app.state, "session_manager", None)
    if sm is None:
        return sanitize_response({
            "status": "BROKER_SESSION_UNAVAILABLE",
            "is_valid": False,
            "auth_token_available": False,
            "feed_token_available": False,
            "last_error": None,
            "last_refresh": None,
        })
    return sanitize_response({
        "status": "OK" if sm.is_valid else "BROKER_SESSION_UNAVAILABLE",
        **sm.status,
    })


# ------------------------------------------------------------------
# Admin-protected — private account data
# ------------------------------------------------------------------

@router.get("/snapshot", dependencies=[Depends(require_admin_token)])
def get_broker_account_snapshot(request: Request):
    """Return combined read-only snapshot of all account sections."""
    svc = _get_sync_service(request)
    return sanitize_response(svc.get_account_snapshot())


@router.get("/holdings", dependencies=[Depends(require_admin_token)])
def get_broker_holdings(request: Request):
    """Return equity holdings from broker (read-only)."""
    svc = _get_sync_service(request)
    return sanitize_response(svc.get_holdings())


@router.get("/positions", dependencies=[Depends(require_admin_token)])
def get_broker_positions(request: Request):
    """Return open positions from broker (read-only)."""
    svc = _get_sync_service(request)
    return sanitize_response(svc.get_positions())


@router.get("/funds", dependencies=[Depends(require_admin_token)])
def get_broker_funds(request: Request):
    """Return funds/margin data from broker (read-only)."""
    svc = _get_sync_service(request)
    return sanitize_response(svc.get_funds())


@router.get("/orders", dependencies=[Depends(require_admin_token)])
def get_broker_order_book(request: Request):
    """Return broker order book (read-only view of existing orders)."""
    svc = _get_sync_service(request)
    return sanitize_response(svc.get_order_book())


@router.get("/trades", dependencies=[Depends(require_admin_token)])
def get_broker_trade_book(request: Request):
    """Return broker trade book (read-only executed trades)."""
    svc = _get_sync_service(request)
    return sanitize_response(svc.get_trade_book())


@router.post("/sync-readonly", dependencies=[Depends(require_admin_token)])
def sync_broker_account_readonly(request: Request):
    """
    Trigger a full read-only sync of all broker account data.

    SAFE: Only reads from broker. No order placement, cancel, or modify.
    Returns combined snapshot.
    """
    svc = _get_sync_service(request)
    result = svc.sync_all_read_only()
    return sanitize_response(result)
