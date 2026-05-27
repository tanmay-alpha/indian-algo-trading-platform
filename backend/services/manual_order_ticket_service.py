"""backend/services/manual_order_ticket_service.py

DRY-RUN ONLY MANUAL ORDER TICKET SERVICE:
This service handles manual order validation only.
It MUST NOT call ExecutionRouter, LiveOrderManager, PaperOrderManager,
or any broker API (placeOrder, cancelOrder, modifyOrder).
It MUST NOT update OMS state, portfolio fills, holdings, positions, or PnL.
It MUST NOT trigger any live order routing.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.orm import Session

from backend.core.config import Settings, settings as default_settings
from backend.db.models import ManualOrderTicket
from backend.execution.models import OrderIntent
from backend.execution.pre_trade_risk_gate import PreTradeRiskGate
from backend.gateway.instrument_registry import get_instrument

_ALLOWED_STATUSES = frozenset({"VALIDATED", "REJECTED", "DISABLED"})


class ManualOrderTicketService:
    """Validation-only manual order ticket service."""

    def __init__(self, db: Session, settings: Settings = default_settings, orchestrator=None):
        self.db = db
        self.settings = settings
        self.orchestrator = orchestrator

    def _safe_status(self, status: str) -> str:
        """Enforce status is in the allowed set. Raises on violation."""
        if status not in _ALLOWED_STATUSES:
            raise ValueError(
                f"MANUAL TICKET SAFETY VIOLATION: attempted to set forbidden status '{status}'."
            )
        return status

    async def validate_ticket(
        self,
        symbol: str,
        exchange: str,
        side: str,
        quantity: int,
        product_type: str,
        order_type: str,
        price_override: Optional[float] = None,
    ) -> ManualOrderTicket:
        """
        Validate a manual order ticket in dry-run mode.
        Runs pre-trade risk checks and persists an audit record.
        NEVER routes to execution or contacts a live broker.
        """
        ticket_id = f"ticket_{uuid.uuid4().hex[:16]}"
        created_at = datetime.now(timezone.utc).isoformat()

        failed_checks: List[str] = []

        # 1. Product Type and Order Type validation (CNC and MARKET only)
        if product_type != "CNC":
            failed_checks.append("invalid_product_type")
        if order_type != "MARKET":
            failed_checks.append("invalid_order_type")

        # 2. Basic parameter validations
        if side not in {"BUY", "SELL"}:
            failed_checks.append("invalid_side")
        if quantity <= 0:
            failed_checks.append("invalid_quantity")
        if not symbol or not symbol.strip():
            failed_checks.append("missing_symbol")
        if not exchange or not exchange.strip():
            failed_checks.append("missing_exchange")

        # 3. Instrument validation
        instrument = None
        if symbol and exchange:
            instrument = get_instrument(symbol, exchange)
            if not instrument:
                failed_checks.append("invalid_instrument")

        # 4. Fetch LTP and determine price source
        ltp = None
        price_source = "UNAVAILABLE"
        market_watch = self.orchestrator.market_watch if self.orchestrator else None
        
        if price_override is not None and price_override > 0:
            ltp = price_override
            price_source = "OVERRIDE_FOR_TEST_ONLY"
        elif instrument and market_watch:
            # Try to fetch from market_watch ticks dictionary
            ticks = getattr(market_watch, "latest_ticks", None)
            tick = ticks.get(symbol) if isinstance(ticks, dict) else None
            if tick:
                ltp = tick.get("ltp") or tick.get("price")
            # If not in ticks, check snapshot
            if ltp is None:
                try:
                    row = market_watch._snapshot_row(symbol)
                    ltp = row.get("ltp")
                except Exception:
                    pass
            if ltp is not None and ltp > 0:
                price_source = "MARKET_WATCH_LTP"

        if ltp is None or ltp <= 0:
            price_source = "UNAVAILABLE"
            if order_type == "MARKET":
                failed_checks.append("market_data_unavailable")

        estimated_notional = None
        if ltp is not None and quantity > 0:
            estimated_notional = ltp * quantity

        # 5. Stronger validation for SELL side
        if side == "SELL" and "invalid_side" not in failed_checks:
            is_paper_or_testing = (
                self.settings.trading_mode == "PAPER"
                or self.settings.environment == "TESTING"
            )
            portfolio_manager = self.orchestrator.portfolio if self.orchestrator else None
            
            if not is_paper_or_testing:
                if not portfolio_manager:
                    failed_checks.append("holdings_verification_unavailable")
                else:
                    holdings_status = getattr(portfolio_manager.holdings, "_data_status", "UNAVAILABLE")
                    if holdings_status != "AVAILABLE":
                        failed_checks.append("holdings_verification_unavailable")
                    else:
                        holding = portfolio_manager.holdings.get_holding(symbol)
                        holding_qty = holding["quantity"] if (holding and isinstance(holding, dict)) else 0
                        
                        position = portfolio_manager.positions.get_position(symbol)
                        position_qty = position["quantity"] if (position and isinstance(position, dict)) else 0
                        
                        total_qty = holding_qty + position_qty
                        if total_qty < quantity:
                            failed_checks.append("insufficient_holdings")

        # 6. Risk Gate Checks and limits
        kill_switch = (
            self.orchestrator.router.kill_switch
            if (self.orchestrator and getattr(self.orchestrator, "router", None))
            else None
        )
        if kill_switch and kill_switch.is_active:
            failed_checks.append("kill_switch_active")

        if quantity > self.settings.max_order_qty:
            failed_checks.append("max_order_qty")

        if estimated_notional is not None and estimated_notional > self.settings.max_order_notional:
            failed_checks.append("max_order_notional")

        # Run PreTradeRiskGate evaluate if basic params & instrument are valid
        if not any(c in failed_checks for c in {
            "invalid_product_type", "invalid_order_type", "invalid_side",
            "invalid_quantity", "missing_symbol", "missing_exchange", "invalid_instrument"
        }):
            portfolio_manager = self.orchestrator.portfolio if self.orchestrator else None
            try:
                risk_gate = PreTradeRiskGate(
                    kill_switch=kill_switch,
                    market_watch=market_watch,
                    portfolio_manager=portfolio_manager,
                    settings=self.settings,
                )
                intent_obj = OrderIntent(
                    symbol=symbol,
                    side=side,
                    quantity=quantity,
                    order_type=order_type,
                    price=ltp,
                    strategy_name="MANUAL_ORDER_TICKET_DRY_RUN",
                    signal_event_id=None,
                    source="MANUAL",
                    trading_mode="LIVE",  # Strictest risk gate rules
                )
                
                # We build a mock latest_market tick for the risk gate if we retrieved it
                latest_market = None
                if ltp is not None:
                    latest_market = {
                        "symbol": symbol,
                        "ltp": ltp,
                        "received_at": datetime.now(timezone.utc).isoformat()
                    }
                
                decision = await risk_gate.evaluate(intent_obj, latest_market=latest_market)
                if not decision.approved:
                    failed_checks.extend(decision.failed_checks)
            except Exception as exc:
                failed_checks.append(f"risk_evaluation_error:{exc.__class__.__name__}")

        # Deduplicate and sort
        failed_checks = sorted(set(failed_checks))

        if failed_checks:
            status = "REJECTED"
            validation_summary = f"Validation failed. Checks: {'; '.join(failed_checks)}"
            rejection_reason = ";".join(failed_checks)
        else:
            status = "VALIDATED"
            validation_summary = "Validation passed. All pre-trade risk checks succeeded. No execution was triggered."
            rejection_reason = None

        ticket = ManualOrderTicket(
            ticket_id=ticket_id,
            created_at=created_at,
            symbol=symbol,
            exchange=exchange,
            side=side,
            quantity=quantity,
            product_type=product_type,
            order_type=order_type,
            price=ltp,
            estimated_notional=estimated_notional,
            price_source=price_source,
            status=self._safe_status(status),
            validation_summary=validation_summary,
            rejection_reason=rejection_reason,
        )
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def get_tickets(self, limit: int = 100) -> List[ManualOrderTicket]:
        """Return recent manual order tickets, newest first."""
        return (
            self.db.query(ManualOrderTicket)
            .order_by(ManualOrderTicket.id.desc())
            .limit(limit)
            .all()
        )
