"""backend/routers/manual_order.py

FastAPI router for Manual Order Ticket dry-run validation.

SAFETY CONTRACT:
  - All endpoints require admin token authentication.
  - All responses include validation_only=True, live_execution_enabled=False,
    broker_mutation_allowed=False as safety markers.
  - This router NEVER triggers live order routing, broker API calls, or portfolio changes.
"""

import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from backend.core.config import settings
from backend.core.security import require_admin_token, sanitize_response, get_db
from backend.services.manual_order_ticket_service import ManualOrderTicketService

router = APIRouter(prefix="/manual-order", tags=["manual-order"])

# Validators for order fields
VALID_SIDES = {"BUY", "SELL"}
VALID_PRODUCT_TYPES = {"CNC", "DELIVERY", "MARGIN", "INTRADAY", "BO"}
VALID_ORDER_TYPES = {"MARKET", "LIMIT", "SL", "SLM"}
VALID_EXCHANGES = {"NSE", "BSE", "NFO", "MCX"}

_SAFETY_MARKERS = {
    "validation_only": True,
    "dry_run": True,
    "live_execution_enabled": False,
    "broker_mutation_allowed": False,
    "creates_fill": False,
    "creates_broker_order": False,
}


class ManualOrderValidateRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Trading symbol")
    exchange: str = Field(..., description="Exchange (NSE, BSE, NFO, MCX)")
    side: str = Field(..., description="Order side (BUY or SELL)")
    quantity: int = Field(..., ge=1, le=10000, description="Order quantity")
    product_type: str = Field(..., description="Product type (CNC, DELIVERY, MARGIN, INTRADAY, BO)")
    order_type: str = Field(..., description="Order type (MARKET, LIMIT, SL, SLM)")
    price_override: Optional[float] = Field(None, ge=0, description="Limit price override")

    @field_validator("exchange")
    @classmethod
    def validate_exchange(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_EXCHANGES:
            raise ValueError(f"Invalid exchange. Must be one of: {VALID_EXCHANGES}")
        return v

    @field_validator("side")
    @classmethod
    def validate_side(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_SIDES:
            raise ValueError(f"Invalid side. Must be one of: {VALID_SIDES}")
        return v

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_PRODUCT_TYPES:
            raise ValueError(f"Invalid product_type. Must be one of: {VALID_PRODUCT_TYPES}")
        return v

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_ORDER_TYPES:
            raise ValueError(f"Invalid order_type. Must be one of: {VALID_ORDER_TYPES}")
        return v


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
