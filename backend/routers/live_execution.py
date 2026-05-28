"""backend/routers/live_execution.py

Phase 26-Safety-Rollback — Live Execution API Router (LOCKED DOWN)
===============================================================
Exposes endpoints to:
- GET  /execution/live/status        — Full live execution status
- POST /execution/live/enable        — Enable live trading (guarded by build lock)
- POST /execution/live/disable       — Disable live trading (always safe)
- POST /execution/live/poller/poll   — Trigger manual poll (guarded by build lock)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.core.security import require_admin_token, sanitize_response
from backend.services.live_execution_service import LiveExecutionService, _POLICY_RESPONSE

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/execution/live",
    tags=["live-execution"],
    dependencies=[Depends(require_admin_token)],
)


class LiveModeRequest(BaseModel):
    confirm: bool = False
    source: Optional[str] = "ADMIN"


def _get_service(request: Request) -> LiveExecutionService:
    """Resolve LiveExecutionService from app state, building it on-demand if needed."""
    svc = getattr(request.app.state, "live_execution_service", None)
    if svc is not None:
        return svc

    orchestrator = getattr(request.app.state, "orchestrator", None)
    execution_router = getattr(request.app.state, "execution_router", None)

    router_obj = None
    kill_switch = None
    session_manager = None
    order_poller = None
    safety_monitor = None

    if orchestrator:
        router_obj = getattr(orchestrator, "router", None)
        kill_switch = getattr(router_obj, "kill_switch", None) if router_obj else None
        session_manager = getattr(request.app.state, "session_manager", None)
        order_poller = getattr(orchestrator, "order_poller", None)
        safety_monitor = getattr(orchestrator, "live_safety_monitor", None)
    elif execution_router:
        router_obj = execution_router
        kill_switch = getattr(execution_router, "kill_switch", None)

    svc = LiveExecutionService(
        execution_router=router_obj,
        order_poller=order_poller,
        kill_switch=kill_switch,
        session_manager=session_manager,
        event_bus=getattr(request.app.state, "event_bus", None),
        live_safety_monitor=safety_monitor,
    )
    request.app.state.live_execution_service = svc
    return svc


@router.get("/status")
def get_live_status(request: Request):
    """Return current live execution state. Read-only."""
    svc = _get_service(request)
    return sanitize_response(svc.get_status())


@router.post("/enable")
async def enable_live(request: Request, body: LiveModeRequest):
    """
    Enable live trading mode. Guarded by build-level lock.
    """
    from backend.core.config import settings
    if not getattr(settings, "live_execution_build_enabled", False):
        logger.warning(
            "POST /execution/live/enable called by source=%s — BLOCKED BY POLICY (live_execution_build_enabled=False)",
            body.source or "UNKNOWN",
        )
        raise HTTPException(status_code=403, detail=_POLICY_RESPONSE["reason"])

    svc = _get_service(request)
    result = await svc.enable_live(confirm=body.confirm, source=body.source or "ADMIN")
    if not result["success"]:
        raise HTTPException(status_code=403, detail=result["reason"])
    return sanitize_response(result)


@router.post("/disable")
async def disable_live(request: Request, body: LiveModeRequest):
    """
    Disable live trading and switch to PAPER mode.
    Always safe.
    """
    svc = _get_service(request)
    result = await svc.disable_live(source=body.source or "ADMIN")
    return sanitize_response(result)


@router.post("/poller/poll")
async def manual_poll(request: Request):
    """
    Trigger manual poll. Guarded by build-level lock.
    """
    from backend.core.config import settings
    if not getattr(settings, "live_execution_build_enabled", False):
        logger.warning("POST /execution/live/poller/poll called — BLOCKED BY POLICY (live_execution_build_enabled=False)")
        raise HTTPException(status_code=503, detail="OrderPoller is not permitted to run in this build.")

    orchestrator = getattr(request.app.state, "orchestrator", None)
    order_poller = getattr(orchestrator, "order_poller", None) if orchestrator else None

    if not order_poller:
        raise HTTPException(status_code=503, detail="OrderPoller not available")

    try:
        await order_poller.poll_once()
        return sanitize_response({"status": "ok", "detail": "manual poll completed"})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Poll failed: {exc.__class__.__name__}")
