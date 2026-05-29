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
import json
from pathlib import Path
from fastapi import APIRouter, Depends, Request

from backend.core.security import require_admin_token, sanitize_response
from backend.services.broker_account_sync import BrokerAccountSyncService
from backend.services.broker_trade_reconciliation import BrokerTradeReconciliationService
from backend.services.broker_account_snapshot_service import BrokerAccountSnapshotService
from backend.services.broker_trade_history_service import BrokerTradeHistoryService
from backend.services.pnl_snapshot_service import PnLSnapshotService
import dataclasses
from typing import Optional

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
    sm = getattr(request.app.state, "session_manager", None)
    snapshot_svc = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = snapshot_svc.get_snapshot()
    return sanitize_response(snapshot.model_dump())


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
    sm = getattr(request.app.state, "session_manager", None)
    snapshot_svc = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = snapshot_svc.get_snapshot()
    return sanitize_response(snapshot.model_dump())


_last_reconciliation_report: Optional[dict] = None


@router.get("/trade-reconciliation/status", dependencies=[Depends(require_admin_token)])
def get_trade_reconciliation_status(request: Request):
    """Return status of trade reconciliation, session availability, and last run report."""
    sm = getattr(request.app.state, "session_manager", None)
    is_valid = sm.is_valid if sm else False
    return sanitize_response({
        "status": "OK",
        "is_valid": is_valid,
        "last_run": _last_reconciliation_report
    })


@router.post("/trade-reconciliation/run", dependencies=[Depends(require_admin_token)])
def run_trade_reconciliation(request: Request):
    """Run trade book reconciliation against internal fill ledger."""
    global _last_reconciliation_report

    sm = getattr(request.app.state, "session_manager", None)
    if sm is None or not sm.is_valid:
        return sanitize_response({
            "status": "BROKER_SESSION_UNAVAILABLE",
            "report": None
        })

    svc = _get_sync_service(request)
    recon_service = BrokerTradeReconciliationService(order_store=getattr(request.app.state, "order_store", None))

    try:
        # Run reconciliation
        report = recon_service.reconcile_from_broker(
            broker_sync_service=svc,
            time_tolerance_seconds=60
        )

        # Convert report to dict to serialize
        report_dict = dataclasses.asdict(report)
        _last_reconciliation_report = report_dict

        return sanitize_response({
            "status": "OK",
            "report": report_dict
        })
    except ValueError as val_err:
        if str(val_err) == "BROKER_SESSION_UNAVAILABLE":
            return sanitize_response({
                "status": "BROKER_SESSION_UNAVAILABLE",
                "report": None
            })
        logger.error(f"Value error during trade reconciliation run: {val_err}", exc_info=True)
        return sanitize_response({
            "status": "ERROR",
            "detail": str(val_err)
        })
    except Exception as exc:
        logger.error(f"Error running trade reconciliation: {exc}", exc_info=True)
        return sanitize_response({
            "status": "ERROR",
            "detail": f"Reconciliation error: {exc}"
        })


@router.post("/history/import", dependencies=[Depends(require_admin_token)])
def import_broker_history(request: Request):
    """
    Trigger read-only history import of trades and orders from Angel One.
    """
    sm = getattr(request.app.state, "session_manager", None)
    history_svc = BrokerTradeHistoryService(session_manager=sm)
    try:
        metadata = history_svc.import_history()
        # Automatically run PnL analytics calculation on new import
        try:
            history_svc.calculate_pnl_analytics()
        except Exception as pnl_err:
            logger.warning(f"Auto PnL calculation failed after import: {pnl_err}")
        return sanitize_response({
            "status": "OK",
            "metadata": metadata
        })
    except ValueError as val_err:
        if str(val_err) == "BROKER_SESSION_UNAVAILABLE":
            return sanitize_response({
                "status": "BROKER_SESSION_UNAVAILABLE",
                "detail": "Cannot import history: Broker session is unavailable."
            })
        return sanitize_response({
            "status": "ERROR",
            "detail": str(val_err)
        })
    except Exception as exc:
        logger.error(f"Error importing history: {exc}", exc_info=True)
        return sanitize_response({
            "status": "ERROR",
            "detail": str(exc)
        })


@router.get("/history/trades", dependencies=[Depends(require_admin_token)])
def get_historical_trades(request: Request):
    """Return list of imported historical trades."""
    history_svc = BrokerTradeHistoryService(session_manager=None)
    trades = history_svc.get_merged_trades()
    return sanitize_response({
        "status": "OK",
        "trades": trades
    })


@router.get("/history/orders", dependencies=[Depends(require_admin_token)])
def get_historical_orders(request: Request):
    """Return list of imported historical orders."""
    history_svc = BrokerTradeHistoryService(session_manager=None)
    orders = history_svc.get_merged_orders()
    return sanitize_response({
        "status": "OK",
        "orders": orders
    })


@router.get("/history/pnl", dependencies=[Depends(require_admin_token)])
def get_pnl_history(request: Request):
    """Return real-time position PnL history/latest snapshot along with historical trades PnL analytics."""
    pnl_svc = PnLSnapshotService()
    history_svc = BrokerTradeHistoryService(session_manager=None)
    
    pnl_file = Path("data/pnl_history/calculated_pnl_analytics.json")
    analytics = None
    if pnl_file.exists():
        try:
            with open(pnl_file, "r") as f:
                analytics = json.load(f)
        except Exception:
            analytics = None
            
    if analytics is None:
        try:
            analytics = history_svc.calculate_pnl_analytics()
        except Exception as e:
            logger.warning(f"Could not calculate historical PnL analytics: {e}")
            analytics = {}
            
    return sanitize_response({
        "status": "OK",
        "latest": pnl_svc.get_latest_pnl_snapshot(),
        "history": pnl_svc.get_pnl_history(),
        "analytics": analytics
    })


@router.post("/history/pnl/calculate", dependencies=[Depends(require_admin_token)])
def calculate_pnl(request: Request):
    """Trigger PnL calculation for open positions."""
    sm = getattr(request.app.state, "session_manager", None)
    svc = PnLSnapshotService(session_manager=sm)
    try:
        report = svc.calculate_and_save_pnl_snapshot()
        return sanitize_response({
            "status": "OK",
            "report": report
        })
    except ValueError as e:
        return sanitize_response({
            "status": str(e),
            "report": None
        })
    except Exception as exc:
        logger.error(f"Error calculating current positions PnL: {exc}", exc_info=True)
        return sanitize_response({
            "status": "ERROR",
            "detail": str(exc)
        })


