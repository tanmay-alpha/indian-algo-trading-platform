"""backend/execution/paper_order_manager.py

Phase 18K — Realistic paper order execution engine.

Execution rules
---------------
1. Market-hours guard (TASK 2)
   Orders arriving outside NSE regular session are rejected with
   reason MARKET_CLOSED unless allow_after_hours is True.

2. Price availability guard (TASK 3)
   A usable reference price is required before any fill is created:
   - LIMIT order: the order's own price field.
   - MARKET order: LTP from latest_market dict (keys: ltp, price).
   If no positive price is available → REJECTED / NO_MARKET_PRICE.

3. Market order fill price with slippage (TASK 4)
   fill_price = reference_price * slippage_factor(side)
   slippage_factor BUY  = 1 + slippage_bps/10000
   slippage_factor SELL = 1 - slippage_bps/10000

4. Limit order behaviour (TASK 5)
   BUY  fills only if limit_price >= reference_price  (marketable)
   SELL fills only if limit_price <= reference_price  (marketable)
   Not marketable → OPEN / LIMIT_NOT_CROSSED (no fill row).
   Marketable → conservative fill price:
     BUY  fill = min(limit_price, ref * slip_factor)  — never worse than limit
     SELL fill = max(limit_price, ref * slip_factor)  — never worse than limit

5. Rejection reasons (TASK 6)
   MARKET_CLOSED, NO_MARKET_PRICE, INVALID_QUANTITY,
   INVALID_SIDE, LIMIT_NOT_CROSSED, PAPER_EXECUTION_ERROR

6. Fill ledger integration (TASK 7)
   fill_id = "{request_id}:0"  (deterministic, idempotent single-fill)
   Fees from NSEFeeModel are persisted alongside fill price.
   avg_fill_price persisted on order_request row.
   Repeated calls with same request_id produce no duplicate fill row
   (record_fill is idempotent via fill_id UNIQUE constraint).

SAFETY
------
- No live trading.
- No broker API calls.
- No credentials.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional, Callable

from loguru import logger

from backend.core.events import OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.execution.fee_model import NSEFeeModel
from backend.execution.order_state_machine import OrderStateMachine
from backend.execution.order_store import OrderStore
from backend.execution.paper_execution_config import PaperExecutionConfig


# ---------------------------------------------------------------------------
# Explicit rejection reason constants
# ---------------------------------------------------------------------------

class PaperRejectReason:
    MARKET_CLOSED          = "MARKET_CLOSED"
    NO_MARKET_PRICE        = "NO_MARKET_PRICE"
    INVALID_QUANTITY       = "INVALID_QUANTITY"
    INVALID_SIDE           = "INVALID_SIDE"
    LIMIT_NOT_CROSSED      = "LIMIT_NOT_CROSSED"
    PAPER_EXECUTION_ERROR  = "PAPER_EXECUTION_ERROR"


# IST offset (UTC+05:30) — avoids pytz/zoneinfo dependency
_IST = timezone(timedelta(hours=5, minutes=30))
_WEEKDAYS = {0, 1, 2, 3, 4}  # Mon=0 … Fri=4


class PaperOrderManager:
    """Realistic paper execution engine for NSE equity simulation.

    Parameters
    ----------
    event_bus : optional
        EventBus for broadcasting OrderStateEvents.
    trade_journal : optional
        Legacy trade journal (Phase 18B compat).
    fee_model : NSEFeeModel, optional
        Fee calculation model; defaults to NSEFeeModel().
    order_state_machine : OrderStateMachine, optional
        In-memory order state tracker.
    order_store : OrderStore, optional
        Persistent OMS / fill-ledger (Phase 18C+).
    config : PaperExecutionConfig, optional
        Realism settings (slippage, market hours).
    _now_fn : Callable[[], datetime], optional
        Injected clock for deterministic testing.  Must return a
        timezone-aware datetime.  Defaults to datetime.now(IST).
    """

    def __init__(
        self,
        event_bus=None,
        trade_journal=None,
        fee_model: Optional[NSEFeeModel] = None,
        order_state_machine: Optional[OrderStateMachine] = None,
        order_store: Optional[OrderStore] = None,
        config: Optional[PaperExecutionConfig] = None,
        _now_fn: Optional[Callable[[], datetime]] = None,
    ):
        self.positions: dict = {}
        self.event_bus = event_bus
        self.trade_journal = trade_journal
        self.fee_model = fee_model or NSEFeeModel()
        self.order_state_machine = order_state_machine or OrderStateMachine(event_bus=event_bus)
        self.order_store = order_store
        self.config = config or PaperExecutionConfig()
        self._now_fn = _now_fn or (lambda: datetime.now(_IST))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def place_order(
        self,
        order_request: OrderRequestEvent,
        latest_market: dict,
    ) -> OrderStateEvent:
        """Route an order through the paper execution rules.

        Never raises.  Returns an OrderStateEvent whose status is one of:
        FILLED, OPEN (limit not crossed), or REJECTED.
        """
        # -- Basic input validation --
        if order_request.quantity <= 0:
            state = self.order_state_machine.create_order(order_request, TradingMode.PAPER.value)
            return self._reject(state.order_id, PaperRejectReason.INVALID_QUANTITY, order_request)

        if order_request.side not in {OrderSide.BUY.value, OrderSide.SELL.value}:
            state = self.order_state_machine.create_order(order_request, TradingMode.PAPER.value)
            return self._reject(state.order_id, PaperRejectReason.INVALID_SIDE, order_request)

        # -- Market-hours guard (TASK 2) --
        state = self.order_state_machine.create_order(order_request, TradingMode.PAPER.value)
        if not self._market_open():
            return self._reject(state.order_id, PaperRejectReason.MARKET_CLOSED, order_request)

        # -- Route by order type --
        if order_request.order_type == OrderType.LIMIT.value:
            # LIMIT orders: market ltp is needed for marketability check.
            # If ltp is absent, park as OPEN (limit may fill later); do not reject.
            # If limit price itself is missing/invalid, reject.
            if order_request.price is None or order_request.price <= 0:
                return self._reject(state.order_id, PaperRejectReason.NO_MARKET_PRICE, order_request)
            market_ltp = self._market_ltp(latest_market or {})  # may be None
            return await self._execute_limit(state, order_request, market_ltp)

        # -- MARKET order: price availability guard (TASK 3) --
        ref_price = self._market_ltp(latest_market or {})
        if ref_price is None:
            return self._reject(state.order_id, PaperRejectReason.NO_MARKET_PRICE, order_request)

        return await self._execute_market(state, order_request, ref_price)


    def place_order_legacy(self, symbol, token, side, quantity, price=None):
        """Legacy synchronous paper execution path (Phase 18B compat).

        Does NOT apply market-hours or slippage rules — kept for backward
        compat with existing callers that do not yet use the async path.
        """
        if quantity <= 0:
            return {"status": OrderStatus.REJECTED.value, "reason": PaperRejectReason.INVALID_QUANTITY}
        self.positions[symbol] = {"side": side, "quantity": quantity, "entry_price": price}
        return {"status": "PAPER_EXECUTED", "symbol": symbol, "quantity": quantity}

    # ------------------------------------------------------------------
    # Internal execution helpers
    # ------------------------------------------------------------------

    async def _execute_market(
        self,
        state,
        order_request: OrderRequestEvent,
        ref_price: float,
    ) -> OrderStateEvent:
        """Fill a MARKET order with slippage applied."""
        try:
            slip = self.config.slippage_factor(order_request.side)
            fill_price = round(ref_price * slip, 2)

            fees = self.fee_model.calculate(order_request.side, order_request.quantity, fill_price)
            total_fees = float(fees.get("total_fees") or 0.0)

            event = self.order_state_machine.transition(
                state.order_id,
                OrderStatus.FILLED.value,
                filled_quantity=order_request.quantity,
                avg_fill_price=fill_price,
            )
            self._update_positions(order_request, fill_price)

            # Persist fill ledger row (TASK 7)
            self._persist_fill(order_request, state, fill_price, total_fees)

            # Legacy trade journal compat
            if self.trade_journal:
                await self.trade_journal.record_fill(
                    event, fees, order_request.strategy_name, order_request.trading_mode
                )

            return event

        except Exception as exc:
            logger.exception(f"PaperOrderManager: unexpected error executing MARKET order: {exc}")
            return self._reject(state.order_id, PaperRejectReason.PAPER_EXECUTION_ERROR, order_request)

    async def _execute_limit(
        self,
        state,
        order_request: OrderRequestEvent,
        market_ltp: Optional[float],
    ) -> OrderStateEvent:
        """Execute or park a LIMIT order based on marketability (TASK 5).

        market_ltp is the current market last-traded price, used to test
        whether the limit order is immediately crossable.  If ltp is absent
        the order is parked as OPEN (limit may fill on a future tick).

        Conservative fill price:
          BUY  → min(limit_price, market_ltp * slip_factor)
          SELL → max(limit_price, market_ltp * slip_factor)
        ensuring the client never fills at a price worse than their limit.
        """
        try:
            limit_price = order_request.price
            # limit_price already validated > 0 in place_order before this call

            if market_ltp is None:
                # No market price available — park the limit order as OPEN
                event = self.order_state_machine.transition(
                    state.order_id,
                    OrderStatus.OPEN.value,
                    reject_reason=PaperRejectReason.LIMIT_NOT_CROSSED,
                )
                self._persist_event(order_request, state, "LIMIT_PARKED", OrderStatus.OPEN.value, "NO_MARKET_PRICE")
                return event

            marketable = self._limit_is_marketable(order_request.side, limit_price, market_ltp)
            if not marketable:
                # Park order as OPEN (no fill, no fill ledger row)
                event = self.order_state_machine.transition(
                    state.order_id,
                    OrderStatus.OPEN.value,
                    reject_reason=PaperRejectReason.LIMIT_NOT_CROSSED,
                )
                self._persist_event(order_request, state, "LIMIT_NOT_CROSSED", OrderStatus.OPEN.value)
                return event

            # Conservative fill price — never worse than limit for the client.
            # Slippage applied to market_ltp, capped by limit_price.
            slip = self.config.slippage_factor(order_request.side)
            slipped = round(market_ltp * slip, 2)
            if order_request.side == OrderSide.BUY.value:
                fill_price = min(limit_price, slipped)
            else:
                fill_price = max(limit_price, slipped)

            fees = self.fee_model.calculate(order_request.side, order_request.quantity, fill_price)
            total_fees = float(fees.get("total_fees") or 0.0)

            event = self.order_state_machine.transition(
                state.order_id,
                OrderStatus.FILLED.value,
                filled_quantity=order_request.quantity,
                avg_fill_price=fill_price,
            )
            self._update_positions(order_request, fill_price)
            self._persist_fill(order_request, state, fill_price, total_fees)

            if self.trade_journal:
                await self.trade_journal.record_fill(
                    event, fees, order_request.strategy_name, order_request.trading_mode
                )

            return event

        except Exception as exc:
            logger.exception(f"PaperOrderManager: unexpected error executing LIMIT order: {exc}")
            return self._reject(state.order_id, PaperRejectReason.PAPER_EXECUTION_ERROR, order_request)

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _persist_fill(
        self,
        order_request: OrderRequestEvent,
        state,
        fill_price: float,
        total_fees: float,
    ) -> None:
        """Write one fill row to the persistent ledger (idempotent via fill_id).

        Uses order_request.event_id as the canonical request_id — this is the
        stable identifier on OrderRequestEvent (the 'request_id' alias used
        throughout the OMS maps to event_id for paper orders).
        """
        if self.order_store is None:
            return
        request_id = order_request.event_id
        try:
            self.order_store.record_fill(
                fill_id=f"{request_id}:0",
                request_id=request_id,
                symbol=order_request.symbol,
                side=order_request.side,
                filled_quantity=order_request.quantity,
                fill_price=fill_price,
                fees=total_fees,
                source="paper",
            )
        except Exception as exc:
            logger.warning(
                f"PaperOrderManager: fill ledger write failed for {request_id}: {exc.__class__.__name__}"
            )

    def _persist_event(
        self,
        order_request: OrderRequestEvent,
        state,
        event_type: str,
        status: str,
        reason: Optional[str] = None,
    ) -> None:
        """Append an order-event row (non-fill transitions) to the audit trail."""
        if self.order_store is None:
            return
        request_id = order_request.event_id
        try:
            self.order_store.add_order_event(
                request_id=request_id,
                event_type=event_type,
                status=status,
                reason=reason,
            )
        except Exception as exc:
            logger.warning(
                f"PaperOrderManager: event log write failed for {request_id}: {exc.__class__.__name__}"
            )

    # ------------------------------------------------------------------
    # Price helpers
    # ------------------------------------------------------------------

    def _market_ltp(self, latest_market: dict) -> Optional[float]:
        """Extract a positive LTP from a market data dict.

        Checks keys: ltp, price.  Returns None if absent or <= 0.
        This is the reference price for MARKET orders and the marketability
        check for LIMIT orders.
        """
        ltp = latest_market.get("ltp") or latest_market.get("price")
        return self._positive_float(ltp)

    def _reference_price(
        self,
        order_request: OrderRequestEvent,
        latest_market: dict,
    ) -> Optional[float]:
        """Backward-compat shim: return the fill reference price for the request.

        MARKET orders: market ltp.  LIMIT orders: limit price.
        Retained for external callers; prefer _market_ltp internally.
        """
        if order_request.order_type == OrderType.LIMIT.value:
            return self._positive_float(order_request.price)
        return self._market_ltp(latest_market)

    @staticmethod
    def _limit_is_marketable(side: str, limit_price: float, ref_price: float) -> bool:
        """Return True when the limit order is immediately fillable at *ref_price*.

        BUY  limit is marketable when limit_price >= ref_price
        SELL limit is marketable when limit_price <= ref_price
        """
        if side == OrderSide.BUY.value:
            return limit_price >= ref_price
        return limit_price <= ref_price

    @staticmethod
    def _positive_float(value) -> Optional[float]:
        if value is None:
            return None
        try:
            parsed = float(value)
            return parsed if parsed > 0 else None
        except (TypeError, ValueError):
            return None

    # ------------------------------------------------------------------
    # Market-hours guard
    # ------------------------------------------------------------------

    def _market_open(self) -> bool:
        """Return True when the NSE regular session is open.

        Short-circuits when market_hours_enforced is False or
        allow_after_hours is True.
        """
        if not self.config.market_hours_enforced or self.config.allow_after_hours:
            return True

        now = self._now_fn()
        # Ensure timezone-aware IST
        if now.tzinfo is None:
            now = now.replace(tzinfo=_IST)

        # Weekend check
        if now.weekday() not in _WEEKDAYS:
            return False

        cfg = self.config
        session_open  = now.replace(hour=cfg.SESSION_OPEN_HOUR,  minute=cfg.SESSION_OPEN_MINUTE,  second=0, microsecond=0)
        session_close = now.replace(hour=cfg.SESSION_CLOSE_HOUR, minute=cfg.SESSION_CLOSE_MINUTE, second=0, microsecond=0)
        return session_open <= now <= session_close

    # ------------------------------------------------------------------
    # Reject helper
    # ------------------------------------------------------------------

    def _reject(
        self,
        order_id: str,
        reason: str,
        order_request: OrderRequestEvent,
    ) -> OrderStateEvent:
        """Transition *order_id* to REJECTED and persist audit event."""
        event = self.order_state_machine.transition(
            order_id,
            OrderStatus.REJECTED.value,
            reject_reason=reason,
        )
        self._persist_event(order_request, type("_S", (), {"order_id": order_id})(), reason, OrderStatus.REJECTED.value, reason)
        return event

    # ------------------------------------------------------------------
    # Position tracking helper
    # ------------------------------------------------------------------

    def _update_positions(self, order_request: OrderRequestEvent, fill_price: float) -> None:
        self.positions[order_request.symbol] = {
            "side": order_request.side,
            "quantity": order_request.quantity,
            "entry_price": fill_price,
        }

    # ------------------------------------------------------------------
    # Legacy compatibility helpers (kept for existing callers)
    # ------------------------------------------------------------------

    def _fill_price(self, order_request: OrderRequestEvent, latest_market: dict) -> Optional[float]:
        """Retained for backward-compat; prefer internal _reference_price + slippage."""
        return self._reference_price(order_request, latest_market)

    def _limit_crossed(self, order_request: OrderRequestEvent, latest_market: dict) -> bool:
        """Retained for backward-compat."""
        ltp = latest_market.get("ltp") or latest_market.get("price")
        if ltp is None or order_request.price is None:
            return False
        return self._limit_is_marketable(order_request.side, order_request.price, float(ltp))
