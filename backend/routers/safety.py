import logging
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.core.security import require_admin_token, sanitize_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/safety",
    tags=["safety"],
    dependencies=[Depends(require_admin_token)]
)

class KillSwitchActionRequest(BaseModel):
    reason: Optional[str] = None
    updated_by: Optional[str] = None


@router.get("/live/status")
def get_live_safety_status(request: Request):
    """
    Expose safety status: kill switch state, reasons, timestamps, rate limit status, and policy constraints.
    """
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        er = getattr(request.app.state, "execution_router", None)
        if not er:
            raise HTTPException(status_code=500, detail="System components not initialized")
        kill_switch = getattr(er, "kill_switch", None)
        live_trading_enabled = getattr(er, "live_enabled", False)
        execution_mode = getattr(er, "mode", "PAPER")
    else:
        kill_switch = getattr(orchestrator.router, "kill_switch", None)
        live_trading_enabled = getattr(orchestrator, "live_enabled", False)
        execution_mode = getattr(orchestrator, "_execution_mode", "PAPER")

    if not kill_switch:
        raise HTTPException(status_code=500, detail="Kill switch not initialized")

    status_data = {
        "kill_switch": kill_switch.status(),
        "live_trading_enabled": live_trading_enabled,
        "execution_mode": execution_mode,
        "broker_mutation_guard": {
            "enabled": True,
            "details": "All place, cancel, modify operations blocked by default"
        },
        "manual_order_policy": {
            "max_quantity": 1,
            "allowed_product_types": ["CNC", "DELIVERY"],
            "allowed_instrument_types": ["EQUITY"],
            "market_orders_dry_run_only": True
        }
    }
    return sanitize_response(status_data)


@router.post("/kill-switch/activate")
def activate_kill_switch(request: Request, body: KillSwitchActionRequest):
    """
    Activate the kill switch to block live trading.
    """
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        er = getattr(request.app.state, "execution_router", None)
        if not er:
            raise HTTPException(status_code=500, detail="System components not initialized")
        kill_switch = getattr(er, "kill_switch", None)
    else:
        kill_switch = getattr(orchestrator.router, "kill_switch", None)

    if not kill_switch:
        raise HTTPException(status_code=500, detail="Kill switch not initialized")

    reason = body.reason or "Manual admin activation"
    source = body.updated_by or "ADMIN"
    kill_switch.activate(reason=reason, source=source)
    
    return sanitize_response({
        "status": "success",
        "message": "Kill switch activated successfully",
        "kill_switch": kill_switch.status()
    })


@router.post("/kill-switch/deactivate")
def deactivate_kill_switch(request: Request, body: KillSwitchActionRequest):
    """
    Deactivate the kill switch.
    """
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if not orchestrator:
        er = getattr(request.app.state, "execution_router", None)
        if not er:
            raise HTTPException(status_code=500, detail="System components not initialized")
        kill_switch = getattr(er, "kill_switch", None)
    else:
        kill_switch = getattr(orchestrator.router, "kill_switch", None)

    if not kill_switch:
        raise HTTPException(status_code=500, detail="Kill switch not initialized")

    source = body.updated_by or "ADMIN"
    success = kill_switch.deactivate(confirm=True, source=source)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to deactivate kill switch")
        
    return sanitize_response({
        "status": "success",
        "message": "Kill switch deactivated successfully",
        "kill_switch": kill_switch.status()
    })
