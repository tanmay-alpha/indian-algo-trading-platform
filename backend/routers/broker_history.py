# backend/routers/broker_history.py
"""
Broker History Router — Phase 25A

Exposes admin-protected endpoints for importing/querying historical broker data,
and calculating/retrieving historical PnL snapshots.

ABSOLUTE SAFETY:
- Read-only endpoints.
- Admin token required.
- Standard sanitization applied.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request

from backend.core.security import require_admin_token, sanitize_response
from backend.services.broker_trade_history_service import BrokerTradeHistoryService
from backend.services.pnl_snapshot_service import PnLSnapshotService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/broker/history",
    tags=["broker-history"],
    dependencies=[Depends(require_admin_token)]
)


def _get_history_service(request: Request) -> BrokerTradeHistoryService:
    sm = getattr(request.app.state, "session_manager", None)
    return BrokerTradeHistoryService(session_manager=sm)


def _get_pnl_service(request: Request) -> PnLSnapshotService:
    sm = getattr(request.app.state, "session_manager", None)
    return PnLSnapshotService(session_manager=sm)


# ------------------------------------------------------------------
# Trade & Order History Routes
# ------------------------------------------------------------------

@router.post("/import")
def trigger_history_import(request: Request, svc: BrokerTradeHistoryService = Depends(_get_history_service)):
    """
    Triggers read-only import of trades and orders from Angel One.
    Deduplicates and saves to local merged files.
    """
    try:
        metadata = svc.import_history()
        return sanitize_response({
            "status": "SUCCESS",
            "metadata": metadata
        })
    except ValueError as val_err:
        if str(val_err) == "BROKER_SESSION_UNAVAILABLE":
            raise HTTPException(
                status_code=400,
                detail="BROKER_SESSION_UNAVAILABLE"
            )
        if str(val_err) == "BROKER_ERROR":
            raise HTTPException(
                status_code=502,
                detail="Broker integration returned an error"
            )
        raise HTTPException(status_code=500, detail=str(val_err))
    except Exception as exc:
        logger.error(f"Error executing history import: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Import error: {exc}")


@router.get("/trades")
def get_historical_trades(svc: BrokerTradeHistoryService = Depends(_get_history_service)):
    """Get the merged historical trades list."""
    trades = svc.get_merged_trades()
    return sanitize_response(trades)


@router.get("/orders")
def get_historical_orders(svc: BrokerTradeHistoryService = Depends(_get_history_service)):
    """Get the merged historical orders list."""
    orders = svc.get_merged_orders()
    return sanitize_response(orders)


@router.get("/status")
def get_history_status(svc: BrokerTradeHistoryService = Depends(_get_history_service)):
    """Get metadata summary of the historical data."""
    meta = svc.get_metadata()
    return sanitize_response(meta)


# ------------------------------------------------------------------
# PnL Snapshot Routes
# ------------------------------------------------------------------

@router.post("/pnl/snapshot")
def calculate_pnl_snapshot(request: Request, svc: PnLSnapshotService = Depends(_get_pnl_service)):
    """
    Calculates unrealized PnL based on latest broker positions and LTP.
    Persists the calculation run.
    """
    try:
        report = svc.calculate_and_save_pnl_snapshot()
        return sanitize_response({
            "status": "SUCCESS",
            "report": report
        })
    except ValueError as val_err:
        if str(val_err) == "BROKER_SESSION_UNAVAILABLE":
            raise HTTPException(
                status_code=400,
                detail="BROKER_SESSION_UNAVAILABLE"
            )
        if str(val_err) == "BROKER_ERROR":
            raise HTTPException(
                status_code=502,
                detail="Broker positions fetch failed"
            )
        raise HTTPException(status_code=500, detail=str(val_err))
    except Exception as exc:
        logger.error(f"Error calculating PnL snapshot: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PnL calculation error: {exc}")


@router.get("/pnl/latest")
def get_latest_pnl_snapshot(svc: PnLSnapshotService = Depends(_get_pnl_service)):
    """Retrieve the detailed report of the latest computed PnL snapshot."""
    snapshot = svc.get_latest_pnl_snapshot()
    if snapshot is None:
        raise HTTPException(status_code=404, detail="No PnL snapshot found. Run /pnl/snapshot first.")
    return sanitize_response(snapshot)


@router.get("/pnl/history")
def get_pnl_history(svc: PnLSnapshotService = Depends(_get_pnl_service)):
    """Retrieve chronological summary points of historical PnL calculations."""
    history = svc.get_pnl_history()
    return sanitize_response(history)


@router.get("/pnl/status")
def get_pnl_status(svc: PnLSnapshotService = Depends(_get_pnl_service)):
    """Retrieve PnL snapshot system metadata (last runtime, totals)."""
    meta = svc.get_metadata()
    return sanitize_response(meta)
