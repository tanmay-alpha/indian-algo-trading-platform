from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from backend.core.events import OrderRequestEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _require_choice(value: str, allowed: set[str], field_name: str) -> None:
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {sorted(allowed)}")


@dataclass
class OrderIntent:
    symbol: str
    side: str
    quantity: int
    order_type: str
    price: Optional[float]
    strategy_name: Optional[str]
    signal_event_id: Optional[str]
    source: str
    trading_mode: str
    metadata: dict[str, Any] = field(default_factory=dict)
    intent_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        self.symbol = (self.symbol or "").strip().upper()
        if not self.symbol:
            raise ValueError("symbol must be non-empty")
        if self.quantity <= 0:
            raise ValueError("quantity must be greater than 0")
        _require_choice(self.side, {OrderSide.BUY.value, OrderSide.SELL.value}, "side")
        _require_choice(self.order_type, {OrderType.MARKET.value, OrderType.LIMIT.value}, "order_type")
        _require_choice(self.trading_mode, {TradingMode.PAPER.value, TradingMode.LIVE.value}, "trading_mode")


@dataclass
class RiskDecision:
    order_intent_id: str
    approved: bool
    rejected_reason: Optional[str]
    failed_checks: list[str]
    max_order_qty: Optional[int]
    max_order_notional: Optional[float]
    estimated_notional: Optional[float]
    market_data_fresh: bool
    kill_switch_active: bool
    decision_id: str = field(default_factory=lambda: str(uuid4()))
    decided_at: datetime = field(default_factory=utc_now)


@dataclass
class ExecutionDecision:
    order_intent_id: str
    risk_decision_id: Optional[str]
    approved: bool
    route: str
    reason: Optional[str]
    execution_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class InternalOrderState:
    order_id: str
    broker_order_id: Optional[str]
    intent_id: Optional[str]
    symbol: str
    side: str
    quantity: int
    filled_quantity: int
    order_type: str
    requested_price: Optional[float]
    avg_fill_price: Optional[float]
    status: str
    reject_reason: Optional[str]
    trading_mode: str
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        _require_choice(
            self.status,
            {
                OrderStatus.PENDING.value,
                OrderStatus.OPEN.value,
                OrderStatus.FILLED.value,
                OrderStatus.REJECTED.value,
                OrderStatus.CANCELLED.value,
            },
            "status",
        )


def order_intent_to_request_event(intent: OrderIntent) -> OrderRequestEvent:
    return OrderRequestEvent(
        symbol=intent.symbol,
        side=intent.side,
        quantity=intent.quantity,
        order_type=intent.order_type,
        price=intent.price,
        strategy_name=intent.strategy_name or "",
        signal_event_id=intent.signal_event_id,
        trading_mode=intent.trading_mode,
        source=intent.source,
    )
