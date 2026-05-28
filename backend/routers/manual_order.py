"""backend/routers/manual_order.py

FastAPI router for Manual Order Ticket dry-run validation.

SAFETY CONTRACT:
  - All endpoints require admin token authentication.
  - All responses include validation_only=True, live_execution_enabled=False,
    broker_mutation_allowed=False as safety markers.
  - This router NEVER triggers live order routing, broker API calls, or portfolio changes.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from backend.core.config import settings
from backend.core.security import require_admin_token, sanitize_response, get_db
from backend.services.manual_order_ticket_service import ManualOrderTicketService

router = APIRouter(prefix="/manual-order", tags=["manual-order"])

_SAFETY_MARKERS = {
    "validation_only": True,
    "dry_run": True,
    "live_execution_enabled": False,
    "broker_mutation_allowed": False,
    "creates_fill": False,
    "creates_broker_order": False,
}


class ManualOrderValidateRequest(BaseModel):
    symbol: str
    exchange: str
    side: str
    quantity: int
    product_type: str
    order_type: str
    price_override: Optional[float] = None


@router.get("/status", dependencies=[Depends(require_admin_token)])
def get_manual_order_status():
    """Return the configuration status for manual orders.

    Always includes safety markers: validation_only=True, live_execution_enabled=False,
    broker_mutation_allowed=False.
    """
    data = {
        "mode": "DRY_RUN_VALIDATION_ONLY",
        **_SAFETY_MARKERS,
    }
    return sanitize_response(data)


@router.post("/validate", dependencies=[Depends(require_admin_token)])
async def validate_manual_order(
    request: Request,
    body: ManualOrderValidateRequest,
    db=Depends(get_db),
):
    """Validate a manual market order ticket in dry-run mode.

    Runs pre-trade risk checks, instrument validation, and persists an audit record.
    NEVER routes to execution or contacts a live broker.
    """
    orchestrator = None
    if hasattr(request.app, "state") and hasattr(request.app.state, "orchestrator"):
        orchestrator = request.app.state.orchestrator

    service = ManualOrderTicketService(db, settings=settings, orchestrator=orchestrator)
    try:
        ticket = await service.validate_ticket(
            symbol=body.symbol,
            exchange=body.exchange,
            side=body.side,
            quantity=body.quantity,
            product_type=body.product_type,
            order_type=body.order_type,
            price_override=body.price_override,
        )
        ticket_data = {
            "ticket_id": ticket.ticket_id,
            "created_at": ticket.created_at,
            "symbol": ticket.symbol,
            "exchange": ticket.exchange,
            "side": ticket.side,
            "quantity": ticket.quantity,
            "product_type": ticket.product_type,
            "order_type": ticket.order_type,
            "price": ticket.price,
            "estimated_notional": ticket.estimated_notional,
            "price_source": ticket.price_source,
            "price_is_override": bool(ticket.price_source == "OVERRIDE_FOR_TEST_ONLY"),
            "status": ticket.status,
            "validation_summary": ticket.validation_summary,
            "rejection_reason": ticket.rejection_reason,
            **_SAFETY_MARKERS,
        }
        return sanitize_response(ticket_data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Manual order validation error: {exc.__class__.__name__}",
        )


@router.get("/tickets", dependencies=[Depends(require_admin_token)])
def get_manual_order_tickets(
    limit: int = Query(default=100, ge=1, le=100),
    db=Depends(get_db),
):
    """Return history of manual order ticket dry-runs (newest first)."""
    service = ManualOrderTicketService(db, settings=settings)
    tickets = service.get_tickets(limit=limit)
    tickets_data = []
    for ticket in tickets:
        tickets_data.append({
            "ticket_id": ticket.ticket_id,
            "created_at": ticket.created_at,
            "symbol": ticket.symbol,
            "exchange": ticket.exchange,
            "side": ticket.side,
            "quantity": ticket.quantity,
            "product_type": ticket.product_type,
            "order_type": ticket.order_type,
            "price": ticket.price,
            "estimated_notional": ticket.estimated_notional,
            "price_source": ticket.price_source,
            "price_is_override": bool(ticket.price_source == "OVERRIDE_FOR_TEST_ONLY"),
            "status": ticket.status,
            "validation_summary": ticket.validation_summary,
            "rejection_reason": ticket.rejection_reason,
            **_SAFETY_MARKERS,
        })
    return sanitize_response(tickets_data)
