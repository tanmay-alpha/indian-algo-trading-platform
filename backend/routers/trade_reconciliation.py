# backend/routers/trade_reconciliation.py
"""
Broker Trade Book Reconciliation API Router

Provides read-only, admin-protected endpoints for trade book reconciliation.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import dataclasses

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.core.security import require_admin_token, sanitize_response
from backend.services.broker_account_sync import BrokerAccountSyncService
from backend.services.broker_trade_reconciliation import BrokerTradeReconciliationService, TradeReconciliationReport

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/reconciliation/tradebook",
    tags=["trade-reconciliation"],
    dependencies=[Depends(require_admin_token)]
)

RECON_DIR = Path("data/reconciliation")


def _get_sync_service(request: Request) -> BrokerAccountSyncService:
    """Create a BrokerAccountSyncService using session_manager from app.state."""
    sm = getattr(request.app.state, "session_manager", None)
    return BrokerAccountSyncService(session_manager=sm)


def _get_order_store(request: Request):
    """Retrieve the OrderStore from app.state or execution_router."""
    store = getattr(request.app.state, "order_store", None)
    if store is None:
        er = getattr(request.app.state, "execution_router", None)
        if er is not None:
            store = getattr(er, "order_store", None)
    return store


def _save_report(report: TradeReconciliationReport):
    """Persist reconciliation report to JSON file in data/reconciliation/."""
    try:
        RECON_DIR.mkdir(parents=True, exist_ok=True)
        report_dict = dataclasses.asdict(report)
        filename = f"reconciliation_report_{report.reconciliation_id}.json"
        filepath = RECON_DIR / filename
        with open(filepath, "w") as f:
            json.dump(report_dict, f, indent=2)
    except Exception as exc:
        logger.error(f"Failed to save reconciliation report to history: {exc}", exc_info=True)


def _get_all_reports() -> List[Dict[str, Any]]:
    """Load all saved reconciliation reports sorted by timestamp descending."""
    if not RECON_DIR.exists():
        return []
    reports = []
    for file in RECON_DIR.glob("reconciliation_report_*.json"):
        try:
            with open(file, "r") as f:
                report_data = json.load(f)
                reports.append(report_data)
        except Exception as e:
            logger.warning(f"Skipping malformed reconciliation file {file}: {e}")
            continue
    # Sort by checked_at or generated_at descending
    reports.sort(key=lambda x: x.get("checked_at", x.get("generated_at", "")), reverse=True)
    return reports


@router.get("/status")
def get_reconciliation_status(request: Request):
    """Return status of trade reconciliation, session availability, and latest report."""
    sm = getattr(request.app.state, "session_manager", None)
    session_available = sm is not None and getattr(sm, "is_valid", False)

    reports = _get_all_reports()
    latest = reports[0] if reports else None

    return sanitize_response({
        "status": "OK",
        "session_available": session_available,
        "latest_report": latest
    })


@router.post("/run")
def run_reconciliation(request: Request):
    """Run trade book reconciliation against internal fill ledger and persist it."""
    sm = getattr(request.app.state, "session_manager", None)
    if sm is None or not sm.is_valid:
        raise HTTPException(
            status_code=400,
            detail="BROKER_SESSION_UNAVAILABLE"
        )

    sync_service = _get_sync_service(request)
    order_store = _get_order_store(request)
    if order_store is None:
        raise HTTPException(
            status_code=503,
            detail="Order store not initialized."
        )

    recon_service = BrokerTradeReconciliationService(order_store=order_store)

    try:
        report = recon_service.reconcile_from_broker(
            broker_sync_service=sync_service,
            time_tolerance_seconds=60
        )
        _save_report(report)
        return sanitize_response(dataclasses.asdict(report))
    except ValueError as val_err:
        if str(val_err) == "BROKER_SESSION_UNAVAILABLE":
            raise HTTPException(
                status_code=400,
                detail="BROKER_SESSION_UNAVAILABLE"
            )
        raise HTTPException(status_code=500, detail=str(val_err))
    except Exception as exc:
        logger.error(f"Error running trade reconciliation: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reconciliation error: {exc}")


@router.get("/latest")
def get_latest_report():
    """Return the most recently run reconciliation report."""
    reports = _get_all_reports()
    latest = reports[0] if reports else None
    return sanitize_response(latest)


@router.get("/history")
def get_reconciliation_history():
    """Return past reconciliation runs sorted by timestamp descending."""
    reports = _get_all_reports()
    return sanitize_response(reports)
