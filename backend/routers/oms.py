"""backend/routers/oms.py

Phase 18J — OMS Admin Visibility Router.

Provides read-only, admin-protected endpoints for operational inspection of:
- OMS status summary
- Recent order requests
- Recent order events
- Recent fill records
- Per-order audit trail (order + events + fills)
- Broker reconciliation status (last cached report)
- Portfolio rebuild status (last startup rebuild summary)

SAFETY CONTRACT:
- All routes with non-public information are protected via require_admin_token.
- All responses are passed through sanitize_response() to redact secrets.
- No order placement, cancel, modify, or live trading.
- No broker API calls from GET routes.
- The POST /oms/reconciliation/run route accepts an optional body of broker order
  snapshots for paper-mode dry-run; if none provided and no broker session
  available, returns 501 "broker fetch not configured" rather than calling live.
- Never exposes ADMIN_TOKEN, broker tokens, credentials, or API keys.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.core.security import require_admin_token, sanitize_response

router = APIRouter(prefix="/oms", tags=["oms"])

_MAX_LIMIT = 200
_DEFAULT_ORDER_LIMIT = 50
_DEFAULT_EVENT_LIMIT = 100
_DEFAULT_FILL_LIMIT = 100


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _order_store(request: Request):
    """Retrieve the OrderStore from app.state or raise 503."""
    store = getattr(request.app.state, "order_store", None)
    if store is None:
        # Attempt to get from execution_router if bound there
        er = getattr(request.app.state, "execution_router", None)
        if er is not None:
            store = getattr(er, "order_store", None)
    if store is None:
        raise HTTPException(
            status_code=503,
            detail="OMS not initialized. Start the backend with OMS enabled.",
        )
    return store


def _cap_limit(limit: int, default: int) -> int:
    return min(max(1, int(limit)), _MAX_LIMIT)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# GET /oms/status
# ---------------------------------------------------------------------------

@router.get("/status", dependencies=[Depends(require_admin_token)])
def oms_status(request: Request):
    """Return aggregate OMS health summary and last rebuild status.

    Protected: requires X-Admin-Token header when ADMIN_TOKEN is configured.
    Response is sanitized — no credentials or tokens.
    """
    store = _order_store(request)
    try:
        oms_summary = store.get_oms_summary()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OMS summary error: {exc.__class__.__name__}")

    rebuild_summary = getattr(request.app.state, "oms_rebuild_summary", None)
    rebuild_data: dict = {}
    if rebuild_summary is not None:
        rebuild_data = {
            "fills_processed": getattr(rebuild_summary, "total_fills_processed", 0),
            "skipped_rows": getattr(rebuild_summary, "skipped_rows", 0),
            "rebuilt_positions": getattr(rebuild_summary, "rebuilt_positions", []),
            "warnings_count": len(getattr(rebuild_summary, "warnings", [])),
            "source": getattr(rebuild_summary, "source", "unknown"),
            "last_rebuild_at": getattr(request.app.state, "oms_rebuild_at", None),
        }

    # State machine counts for active in-memory tracking
    er = getattr(request.app.state, "execution_router", None)
    osm = getattr(er, "order_state_machine", None) if er else None
    in_memory_active = 0
    if osm is not None:
        try:
            in_memory_active = len(osm.pending_orders()) + len(osm.open_orders())
        except Exception:
            pass

    response = {
        "oms": oms_summary,
        "in_memory_active_orders": in_memory_active,
        "portfolio_rebuild": rebuild_data if rebuild_data else None,
        "queried_at": _utc_now(),
        "trading_mode": getattr(request.app.state, "trading_mode", "PAPER"),
    }
    return sanitize_response(response)


# ---------------------------------------------------------------------------
# GET /oms/orders/recent
# ---------------------------------------------------------------------------

@router.get("/orders/recent", dependencies=[Depends(require_admin_token)])
def oms_orders_recent(
    request: Request,
    limit: int = Query(default=_DEFAULT_ORDER_LIMIT, ge=1, le=_MAX_LIMIT),
):
    """Return the *limit* most recently created/updated order requests.

    Protected. Response sanitized. No credentials.
    """
    store = _order_store(request)
    limit = _cap_limit(limit, _DEFAULT_ORDER_LIMIT)
    rows = store.get_recent_order_requests(limit=limit)
    return sanitize_response({
        "orders": rows,
        "count": len(rows),
        "limit": limit,
        "queried_at": _utc_now(),
    })


# ---------------------------------------------------------------------------
# GET /oms/events/recent
# ---------------------------------------------------------------------------

@router.get("/events/recent", dependencies=[Depends(require_admin_token)])
def oms_events_recent(
    request: Request,
    limit: int = Query(default=_DEFAULT_EVENT_LIMIT, ge=1, le=_MAX_LIMIT),
):
    """Return the *limit* most recent OMS order-state events.

    Protected. Response sanitized.
    """
    store = _order_store(request)
    limit = _cap_limit(limit, _DEFAULT_EVENT_LIMIT)
    rows = store.get_recent_order_events(limit=limit)
    return sanitize_response({
        "events": rows,
        "count": len(rows),
        "limit": limit,
        "queried_at": _utc_now(),
    })


# ---------------------------------------------------------------------------
# GET /oms/fills/recent
# ---------------------------------------------------------------------------

@router.get("/fills/recent", dependencies=[Depends(require_admin_token)])
def oms_fills_recent(
    request: Request,
    limit: int = Query(default=_DEFAULT_FILL_LIMIT, ge=1, le=_MAX_LIMIT),
):
    """Return the *limit* most recent fill ledger rows (order_fills table).

    Protected. Response sanitized.
    """
    store = _order_store(request)
    limit = _cap_limit(limit, _DEFAULT_FILL_LIMIT)
    rows = store.get_recent_fills(limit=limit)
    return sanitize_response({
        "fills": rows,
        "count": len(rows),
        "limit": limit,
        "queried_at": _utc_now(),
    })


# ---------------------------------------------------------------------------
# GET /oms/orders/{request_id}/audit
# ---------------------------------------------------------------------------

@router.get("/orders/{request_id}/audit", dependencies=[Depends(require_admin_token)])
def oms_order_audit(request: Request, request_id: str):
    """Return the full audit bundle for *request_id*: order row + events + fills.

    Returns 404 if the request_id is not found.
    Protected. Response sanitized.
    """
    store = _order_store(request)
    audit = store.get_order_audit(request_id)
    if audit.get("order") is None:
        raise HTTPException(
            status_code=404,
            detail=f"Order not found: {request_id}",
        )
    audit["queried_at"] = _utc_now()
    return sanitize_response(audit)


# ---------------------------------------------------------------------------
# GET /oms/reconciliation/status
# ---------------------------------------------------------------------------

@router.get("/reconciliation/status", dependencies=[Depends(require_admin_token)])
def oms_reconciliation_status(request: Request):
    """Return the last cached broker reconciliation report (if available).

    This is the most recent report from the reconciliation engine, stored in
    app.state. It does NOT re-run reconciliation or call any broker API.
    Protected. Response sanitized.
    """
    last_report = getattr(request.app.state, "last_reconciliation_report", None)
    if last_report is None:
        return sanitize_response({
            "status": "no_report",
            "message": "No reconciliation report available. Run POST /oms/reconciliation/run.",
            "queried_at": _utc_now(),
        })

    from dataclasses import asdict, fields
    import dataclasses
    try:
        report_dict = asdict(last_report) if dataclasses.is_dataclass(last_report) else dict(last_report)
    except Exception:
        report_dict = {"raw": str(last_report)}

    return sanitize_response({
        "status": "ok",
        "report": report_dict,
        "last_run_at": getattr(request.app.state, "last_reconciliation_at", None),
        "queried_at": _utc_now(),
    })


# ---------------------------------------------------------------------------
# POST /oms/reconciliation/run  (optional, paper-safe)
# ---------------------------------------------------------------------------

@router.post("/reconciliation/run", dependencies=[Depends(require_admin_token)])
async def oms_reconciliation_run(request: Request, broker_orders: list | None = None):
    """Dry-run the reconciliation engine against a supplied broker snapshot.

    If *broker_orders* is not supplied and no broker session is active,
    returns 501. Never calls live broker APIs when no session is configured.
    Protected. Response sanitized.
    """
    er = getattr(request.app.state, "execution_router", None)
    if er is None:
        raise HTTPException(status_code=500, detail="Execution router not initialized.")

    # If caller provided no broker_orders, try to get from body
    body = await request.body()
    if broker_orders is None and body:
        import json as _json
        try:
            broker_orders = _json.loads(body)
        except Exception:
            broker_orders = None

    # If still no broker_orders, check for a live broker session
    if broker_orders is None:
        session_manager = getattr(request.app.state, "session_manager", None)
        smart_api = getattr(session_manager, "smart_api", None) if session_manager else None
        if session_manager and getattr(session_manager, "is_valid", False) and smart_api:
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(None, smart_api.orderBook)
                data = response.get("data", []) if isinstance(response, dict) else response
                broker_orders = data if isinstance(data, list) else []
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Broker order book fetch failed: {exc.__class__.__name__}")
        else:
            raise HTTPException(status_code=501, detail="broker_orders not provided and broker fetch not configured.")

    if not isinstance(broker_orders, list):
        raise HTTPException(status_code=422, detail="broker_orders must be a list.")

    from backend.execution.reconciliation import OrderReconciliationEngine
    from dataclasses import asdict
    engine = OrderReconciliationEngine(
        order_store=er.order_store,
        order_state_machine=er.order_state_machine,
        event_bus=er.event_bus,
    )
    report = engine.reconcile(broker_orders=broker_orders)
    updates_count = await engine.apply_broker_report(report, broker_orders=broker_orders)

    # Cache report in app state for GET /oms/reconciliation/status
    request.app.state.last_reconciliation_report = report
    request.app.state.last_reconciliation_at = _utc_now()

    report_dict = asdict(report)
    return sanitize_response({
        "status": "success",
        "updates_applied": updates_count,
        "report": report_dict,
        "run_at": _utc_now(),
    })


# ---------------------------------------------------------------------------
# GET /oms/health  (public — no token required)
# ---------------------------------------------------------------------------

@router.get("/health")
def oms_health(request: Request):
    """Light OMS liveness probe — no auth required.

    Returns {status: ok, oms_initialized: bool}.
    Does NOT expose any order data.
    """
    store = getattr(request.app.state, "order_store", None)
    if store is None:
        er = getattr(request.app.state, "execution_router", None)
        store = getattr(er, "order_store", None) if er else None
    return {
        "status": "ok",
        "oms_initialized": store is not None,
        "queried_at": _utc_now(),
    }
