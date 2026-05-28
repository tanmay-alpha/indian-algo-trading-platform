"""backend/routers/live_execution.py

Phase 26B — Live Execution API Router
======================================
Exposes endpoints to:
- GET  /execution/live/status        — Full live execution status
- POST /execution/live/enable        — Enable live trading (with confirm flag)
- POST /execution/live/disable       — Disable live trading (always safe)
- POST /execution/live/poller/poll   — Trigger a single manual poll cycle (admin)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.core.security import require_admin_token, sanitize_response
from backend.services.live_execution_service import LiveExecutionService

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

    # Build on-demand from available components (graceful degradation)
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
    """Return full live execution status including mode, poller, safety monitor, and order counts."""
    svc = _get_service(request)
    return sanitize_response(svc.get_status())


@router.post("/enable")
async def enable_live(request: Request, body: LiveModeRequest):
    """
    Enable live trading mode.

    Requires confirm=True and all safety interlocks to pass:
    - Kill switch must be inactive
    - Broker session must be valid
    - No pending/open orders
    - No open positions
    """
    svc = _get_service(request)
    result = await svc.enable_live(confirm=body.confirm, source=body.source or "ADMIN")
    if not result["success"]:
        raise HTTPException(status_code=403, detail=result["reason"])
    return sanitize_response(result)


@router.post("/disable")
async def disable_live(request: Request, body: LiveModeRequest):
    """
    Disable live trading and switch to PAPER mode.
    Also stops the OrderPoller. Always safe — cannot be blocked.
    """
    svc = _get_service(request)
    result = await svc.disable_live(source=body.source or "ADMIN")
    return sanitize_response(result)


@router.post("/poller/poll")
async def manual_poll(request: Request):
    """
    Trigger a single manual order book poll cycle.
    Useful for immediate status refresh without waiting for the next scheduled poll.
    """
    orchestrator = getattr(request.app.state, "orchestrator", None)
    order_poller = getattr(orchestrator, "order_poller", None) if orchestrator else None

    if not order_poller:
        raise HTTPException(status_code=503, detail="OrderPoller not available")

    try:
        await order_poller.poll_once()
        return sanitize_response({"status": "ok", "detail": "manual poll completed"})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Poll failed: {exc.__class__.__name__}")
