from dataclasses import replace
from typing import Optional
from uuid import uuid4

from backend.core.events import OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderStatus
from backend.execution.models import InternalOrderState, OrderIntent, utc_now


TERMINAL = {OrderStatus.FILLED.value, OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value}
TRANSITIONS = {
    OrderStatus.PENDING.value: {OrderStatus.OPEN.value, OrderStatus.FILLED.value, OrderStatus.REJECTED.value},
    OrderStatus.OPEN.value: {OrderStatus.FILLED.value, OrderStatus.CANCELLED.value, OrderStatus.REJECTED.value},
}


class OrderStateMachine:
    def __init__(self, event_bus=None):
        self._orders: dict[str, InternalOrderState] = {}
        self._event_bus = event_bus

    def create_order(self, intent_or_request, trading_mode: str) -> InternalOrderState:
        order_id = str(uuid4())
        if isinstance(intent_or_request, OrderIntent):
            intent_id = intent_or_request.intent_id
            symbol = intent_or_request.symbol
            side = intent_or_request.side
            quantity = intent_or_request.quantity
            order_type = intent_or_request.order_type
            price = intent_or_request.price
        elif isinstance(intent_or_request, OrderRequestEvent):
            intent_id = intent_or_request.event_id
            symbol = intent_or_request.symbol
            side = intent_or_request.side
            quantity = intent_or_request.quantity
            order_type = intent_or_request.order_type
            price = intent_or_request.price
        else:
            raise TypeError("create_order expects OrderIntent or OrderRequestEvent")
        state = InternalOrderState(
            order_id=order_id,
            broker_order_id=None,
            intent_id=intent_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            filled_quantity=0,
            order_type=order_type,
            requested_price=price,
            avg_fill_price=None,
            status=OrderStatus.PENDING.value,
            reject_reason=None,
            trading_mode=trading_mode,
        )
        self._orders[order_id] = state
        return state

    def transition(self, order_id: str, new_status: str, **updates) -> OrderStateEvent:
        current = self._orders.get(order_id)
        if not current:
            raise KeyError(order_id)
        self._validate_transition(current.status, new_status, updates.get("reject_reason"))
        state = replace(
            current,
            broker_order_id=updates.get("broker_order_id", current.broker_order_id),
            filled_quantity=updates.get("filled_quantity", current.filled_quantity),
            avg_fill_price=updates.get("avg_fill_price", current.avg_fill_price),
            status=new_status,
            reject_reason=updates.get("reject_reason", current.reject_reason),
            updated_at=utc_now(),
        )
        self._orders[order_id] = state
        event = self._to_event(state)
        self._publish(event)
        return event

    def get(self, order_id: str) -> Optional[InternalOrderState]:
        return self._orders.get(order_id)

    def pending_orders(self) -> list[InternalOrderState]:
        return [order for order in self._orders.values() if order.status == OrderStatus.PENDING.value]

    def open_orders(self) -> list[InternalOrderState]:
        return [order for order in self._orders.values() if order.status == OrderStatus.OPEN.value]

    def has_pending_or_open_orders(self) -> bool:
        return bool(self.pending_orders() or self.open_orders())

    def status(self) -> dict:
        by_status: dict[str, int] = {}
        for order in self._orders.values():
            by_status[order.status] = by_status.get(order.status, 0) + 1
        return {
            "total_orders": len(self._orders),
            "by_status": by_status,
            "pending": len(self.pending_orders()),
            "open": len(self.open_orders()),
        }

    def _validate_transition(self, current: str, new: str, reason: Optional[str]) -> None:
        if current == new:
            return
        if current in TERMINAL:
            raise ValueError("terminal order cannot transition")
        if new == OrderStatus.REJECTED.value and reason:
            return
        if new not in TRANSITIONS.get(current, set()):
            raise ValueError(f"invalid transition {current}->{new}")

    def _to_event(self, state: InternalOrderState) -> OrderStateEvent:
        return OrderStateEvent(
            order_id=state.order_id,
            broker_order_id=state.broker_order_id,
            symbol=state.symbol,
            side=state.side,
            quantity=state.quantity,
            filled_quantity=state.filled_quantity,
            avg_fill_price=state.avg_fill_price,
            status=state.status,
            reject_reason=state.reject_reason,
            order_request_id=state.intent_id,
        )

    def _publish(self, event: OrderStateEvent) -> None:
        if not self._event_bus:
            return
        try:
            import asyncio

            loop = asyncio.get_running_loop()
            loop.create_task(self._event_bus.publish(event))
        except RuntimeError:
            pass
