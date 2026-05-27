"""backend/routers/live_approval_sandbox.py

FastAPI router for the Manual Live Approval Sandbox (disabled by default).

SAFETY INVARIANTS:
  - All endpoints require admin token authentication.
  - All responses include validation_only=True, live_execution_enabled=False,
    broker_mutation_allowed=False as safety markers.
  - No route named approve-live or execute-live exists here.
  - This router NEVER triggers order routing, broker API calls, or OMS mutations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from backend.core.config import settings
from backend.core.security import require_admin_token, sanitize_response, get_db
from backend.services.live_approval_sandbox_service import LiveApprovalSandboxService

router = APIRouter(prefix="/live-approval/sandbox", tags=["live-approval-sandbox"])

# Safety constants — included in every response to make the mode explicit
_SAFETY_MARKERS = {
    "validation_only": True,
    "live_execution_enabled": False,
    "broker_mutation_allowed": False,
}


class SandboxValidateRequest(BaseModel):
    symbol: str
    side: str
    quantity: int
    product_type: str
    order_type: str
    price: Optional[float] = None
    source_signal_id: Optional[str] = None


@router.get("/status", dependencies=[Depends(require_admin_token)])
def get_sandbox_status():
    """Return the current configuration of the live approval sandbox.

    Always includes safety markers: validation_only=True, live_execution_enabled=False,
    broker_mutation_allowed=False. Will NEVER change to indicate execution is possible.
    """
    data = {
        "sandbox_enabled": settings.live_approval_sandbox_enabled,
        "mode": "VALIDATION_ONLY",
        **_SAFETY_MARKERS,
    }
    return sanitize_response(data)


@router.post("/validate", dependencies=[Depends(require_admin_token)])
async def validate_sandbox_intent(
    request: Request,
    body: SandboxValidateRequest,
    db=Depends(get_db),
):
    """Validate a manual live trading intent in dry-run mode.

    Runs pre-trade risk checks and persists an audit record.
    NEVER routes to execution or contacts a live broker.
    All responses include validation_only=True, live_execution_enabled=False,
    broker_mutation_allowed=False.
    """
    orchestrator = None
    if hasattr(request.app, "state") and hasattr(request.app.state, "orchestrator"):
        orchestrator = request.app.state.orchestrator

    service = LiveApprovalSandboxService(db, settings=settings, orchestrator=orchestrator)
    try:
        intent = await service.validate_intent(
            symbol=body.symbol,
            side=body.side,
            quantity=body.quantity,
            product_type=body.product_type,
            order_type=body.order_type,
            price=body.price,
            source_signal_id=body.source_signal_id,
        )
        intent_dict = {
            "intent_id": intent.intent_id,
            "created_at": intent.created_at,
            "symbol": intent.symbol,
            "side": intent.side,
            "quantity": intent.quantity,
            "product_type": intent.product_type,
            "order_type": intent.order_type,
            "source_signal_id": intent.source_signal_id,
            "status": intent.status,
            "validation_summary": intent.validation_summary,
            "rejection_reason": intent.rejection_reason,
            **_SAFETY_MARKERS,
        }
        return sanitize_response(intent_dict)
    except Exception as exc:
        # Only expose the exception class name — never str(exc) which may contain internals
        raise HTTPException(
            status_code=500,
            detail=f"Sandbox validation error: {exc.__class__.__name__}",
        )


@router.get("/intents", dependencies=[Depends(require_admin_token)])
def get_sandbox_intents(
    limit: int = Query(default=100, ge=1, le=100),
    db=Depends(get_db),
):
    """Return history of sandbox validation intents (newest first).

    All responses are sanitized to prevent sensitive data leakage.
    """
    service = LiveApprovalSandboxService(db, settings=settings)
    intents = service.get_intents(limit=limit)
    intents_data = []
    for intent in intents:
        intents_data.append({
            "intent_id": intent.intent_id,
            "created_at": intent.created_at,
            "symbol": intent.symbol,
            "side": intent.side,
            "quantity": intent.quantity,
            "product_type": intent.product_type,
            "order_type": intent.order_type,
            "source_signal_id": intent.source_signal_id,
            "status": intent.status,
            "validation_summary": intent.validation_summary,
            "rejection_reason": intent.rejection_reason,
            **_SAFETY_MARKERS,
        })
    return sanitize_response(intents_data)
