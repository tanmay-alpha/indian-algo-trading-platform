import json
from dataclasses import fields, is_dataclass, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import ClassVar, Optional, Union
from uuid import uuid4

from backend.core.types import OrderSide, OrderType


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EventType(str, Enum):
    TICK = "TICK"
    SIGNAL = "SIGNAL"
    ORDER_REQUEST = "ORDER_REQUEST"
    ORDER_STATE = "ORDER_STATE"
    RISK = "RISK"
    PORTFOLIO = "PORTFOLIO"
    GATEWAY_STATUS = "GATEWAY_STATUS"
    SESSION = "SESSION"
    SYSTEM_HEALTH = "SYSTEM_HEALTH"
    ERROR = "ERROR"
    LOG = "LOG"


@dataclass
class TickEvent:
    event_type: ClassVar[str] = EventType.TICK.value
    symbol: str
    token: Optional[str]
    exchange: str
    ltp: Optional[float]
    best_bid: Optional[float]
    best_ask: Optional[float]
    bid_qty: Optional[int]
    ask_qty: Optional[int]
    spread: Optional[float]
    vwap: Optional[float]
    volume: Optional[int]
    ltq: Optional[int]
    exchange_timestamp: Optional[str]
    received_at: datetime
    source: str = "SMARTAPI"
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class SignalEvent:
    event_type: ClassVar[str] = EventType.SIGNAL.value
    symbol: str
    strategy_name: str
    action: str
    strength: float
    reason: str
    ltp: Optional[float]
    indicators: dict[str, float]
    source_tick_event_id: Optional[str]
    mode: Optional[str] = None
    strategy_id: Optional[int] = None
    signal_id: Optional[int] = None
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)

    @property
    def data(self) -> dict:
        return {
            "symbol": self.symbol,
            "side": self.action,
            "mode": self.mode,
            "strategy_id": self.strategy_id,
            "signal_id": self.signal_id,
        }

    def __post_init__(self):
        if not 0.0 <= self.strength <= 1.0:
            raise ValueError("Signal strength must be between 0.0 and 1.0")


@dataclass
class OrderRequestEvent:
    event_type: ClassVar[str] = EventType.ORDER_REQUEST.value
    symbol: str
    side: str
    quantity: int
    order_type: str
    price: Optional[float]
    strategy_name: str
    signal_event_id: Optional[str]
    trading_mode: str
    source: str
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)

    def __post_init__(self):
        if self.quantity <= 0:
            raise ValueError("Order quantity must be greater than 0")
        if self.side not in {OrderSide.BUY.value, OrderSide.SELL.value}:
            raise ValueError("Order side must be BUY or SELL")
        if self.order_type not in {OrderType.MARKET.value, OrderType.LIMIT.value}:
            raise ValueError("Order type must be MARKET or LIMIT")


@dataclass
class OrderStateEvent:
    event_type: ClassVar[str] = EventType.ORDER_STATE.value
    order_id: str
    broker_order_id: Optional[str]
    symbol: str
    side: str
    quantity: int
    filled_quantity: int
    avg_fill_price: Optional[float]
    status: str
    reject_reason: Optional[str]
    order_request_id: Optional[str]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class RiskEvent:
    event_type: ClassVar[str] = EventType.RISK.value
    order_request_id: str
    passed: bool
    failed_checks: list[str]
    max_order_qty: Optional[int]
    max_order_notional: Optional[float]
    current_daily_pnl: Optional[float]
    reason: Optional[str]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class PortfolioEvent:
    event_type: ClassVar[str] = EventType.PORTFOLIO.value
    positions: list[dict]
    unrealised_pnl: float
    realised_pnl: float
    total_pnl: float
    daily_drawdown: float
    trading_mode: str
    equity: Optional[float]
    cash: Optional[float]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class GatewayStatusEvent:
    event_type: ClassVar[str] = EventType.GATEWAY_STATUS.value
    status: str
    detail: Optional[str]
    connection_state: Optional[str]
    tick_count: int
    dropped_tick_count: int
    drop_rate_pct: float
    subscribed_symbols: list[str]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class SessionEvent:
    event_type: ClassVar[str] = EventType.SESSION.value
    status: str
    logged_in: bool
    feed_token_available: bool
    detail: Optional[str]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class SystemHealthEvent:
    event_type: ClassVar[str] = EventType.SYSTEM_HEALTH.value
    component: str
    status: str
    detail: Optional[str]
    metrics: dict[str, float | int | str | bool | None]
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class ErrorEvent:
    event_type: ClassVar[str] = EventType.ERROR.value
    component: str
    error_type: str
    safe_message: str
    severity: str
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


@dataclass
class LogEvent:
    event_type: ClassVar[str] = EventType.LOG.value
    level: str
    component: str
    message: str
    event_id: str = field(default_factory=lambda: str(uuid4()))
    occurred_at: datetime = field(default_factory=utc_now)


AnyEvent = Union[
    TickEvent,
    SignalEvent,
    OrderRequestEvent,
    OrderStateEvent,
    RiskEvent,
    PortfolioEvent,
    GatewayStatusEvent,
    SessionEvent,
    SystemHealthEvent,
    ErrorEvent,
    LogEvent,
]


_EVENT_CLASS_BY_TYPE = {
    cls.event_type: cls
    for cls in (
        TickEvent,
        SignalEvent,
        OrderRequestEvent,
        OrderStateEvent,
        RiskEvent,
        PortfolioEvent,
        GatewayStatusEvent,
        SessionEvent,
        SystemHealthEvent,
        ErrorEvent,
        LogEvent,
    )
}


def get_event_type(event: AnyEvent) -> str:
    return event.event_type


def event_to_dict(event: AnyEvent) -> dict:
    if not is_dataclass(event):
        raise TypeError("event_to_dict expects a dataclass event")

    data = {"event_type": get_event_type(event)}
    for event_field in fields(event):
        data[event_field.name] = _to_json_safe(getattr(event, event_field.name))
    return data


def event_to_json(event: AnyEvent) -> str:
    return json.dumps(event_to_dict(event))


def event_from_dict(data: dict) -> AnyEvent:
    event_type = data.get("event_type")
    event_cls = _EVENT_CLASS_BY_TYPE.get(event_type)
    if not event_cls:
        raise ValueError(f"Unknown event_type: {event_type}")

    kwargs = {}
    field_names = {event_field.name for event_field in fields(event_cls)}
    for key, value in data.items():
        if key == "event_type" or key not in field_names:
            continue
        if key in {"occurred_at", "received_at"} and isinstance(value, str):
            kwargs[key] = _parse_datetime(value)
        else:
            kwargs[key] = value

    return event_cls(**kwargs)


def _to_json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return event_to_dict(value)
    if isinstance(value, list):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_json_safe(item) for key, item in value.items()}
    return value


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
