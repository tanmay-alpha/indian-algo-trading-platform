import os
import glob
import json
import logging
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.core.security import require_admin_token
from backend.services.broker_account_reconciliation import BrokerAccountReconciliationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reconciliation/account", tags=["Account Reconciliation"])

REPORTS_DIR = "data/reconciliation/account"


def _get_broker_sync_service(request: Request):
    sm = getattr(request.app.state, "session_manager", None)
    if not sm:
        raise HTTPException(status_code=500, detail="Session manager not initialized")
    from backend.services.broker_account_sync import BrokerAccountSyncService
    return BrokerAccountSyncService(session_manager=sm)


def _get_portfolio_engine(request: Request):
    return getattr(request.app.state, "portfolio_engine", None)


def _get_all_reports() -> List[Dict[str, Any]]:
    if not os.path.exists(REPORTS_DIR):
        return []
    files = glob.glob(os.path.join(REPORTS_DIR, "acc_recon_*.json"))
    reports = []
    for fpath in files:
        try:
            with open(fpath, "r") as f:
                rep = json.load(f)
                reports.append(rep)
        except Exception as e:
            logger.error(f"Error reading account reconciliation report {fpath}: {e}")
            continue
    # Sort by generated_at descending
    reports.sort(key=lambda r: r.get("generated_at", ""), reverse=True)
    return reports


@router.get("/status", dependencies=[Depends(require_admin_token)])
def get_reconciliation_status():
    """Get status of the latest account reconciliation report."""
    reports = _get_all_reports()
    if not reports:
        return {"status": "NO_REPORTS"}
    latest = reports[0]
    return {
        "status": latest.get("overall_status"),
        "generated_at": latest.get("generated_at"),
        "mismatch_count": latest.get("mismatch_count")
    }


@router.post("/run", dependencies=[Depends(require_admin_token)])
def run_reconciliation(request: Request):
    """Run an on-demand account reconciliation (read-only)."""
    sync_svc = _get_broker_sync_service(request)
    portfolio_engine = _get_portfolio_engine(request)

    recon_svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine)
    try:
        report = recon_svc.reconcile_from_broker(sync_svc)
        import dataclasses
        return {
            "status": "OK",
            "report": dataclasses.asdict(report)
        }
    except Exception as exc:
        logger.error(f"Error running account reconciliation: {exc}", exc_info=True)
        return {
            "status": "ERROR",
            "detail": f"Account reconciliation error: {exc}"
        }


@router.get("/latest", dependencies=[Depends(require_admin_token)])
def get_latest_report():
    """Retrieve the full JSON of the latest account reconciliation report."""
    reports = _get_all_reports()
    if not reports:
        raise HTTPException(status_code=404, detail="No account reconciliation reports found")
    return reports[0]


@router.get("/history", dependencies=[Depends(require_admin_token)])
def get_report_history():
    """Retrieve a list of historical account reconciliation reports (summaries)."""
    reports = _get_all_reports()
    summaries = []
    for r in reports:
        summaries.append({
            "reconciliation_id": r.get("reconciliation_id"),
            "generated_at": r.get("generated_at"),
            "overall_status": r.get("overall_status"),
            "mismatch_count": r.get("mismatch_count")
        })
    return summaries
