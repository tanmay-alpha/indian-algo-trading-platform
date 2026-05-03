import json
from datetime import datetime, timezone
from uuid import UUID

import pytest

from backend.core.event_bus import EventBus
from backend.core.events import (
    EventType,
    TickEvent,
    SignalEvent,
    OrderRequestEvent,
    OrderStateEvent,
    LogEvent,
    event_from_dict,
    event_to_dict,
    event_to_json,
)


def make_tick_event() -> TickEvent:
    return TickEvent(
        symbol="SBIN",
        token="3045",
        exchange="NSE",
        ltp=750.5,
        best_bid=750.4,
        best_ask=750.6,
        bid_qty=100,
        ask_qty=120,
        spread=0.2,
        vwap=749.9,
        volume=100000,
        ltq=25,
        exchange_timestamp="2026-05-03T09:15:01",
        received_at=datetime.now(timezone.utc),
    )


def test_tick_event_auto_fields():
    event = make_tick_event()

    assert UUID(event.event_id).version == 4
    assert isinstance(event.occurred_at, datetime)
    assert isinstance(event.received_at, datetime)
    assert event.event_type == EventType.TICK.value


def test_event_to_dict_serializes_datetime_and_event_type():
    event = make_tick_event()

    data = event_to_dict(event)

    assert data["event_type"] == EventType.TICK.value
    assert isinstance(data["occurred_at"], str)
    assert isinstance(data["received_at"], str)
    assert datetime.fromisoformat(data["occurred_at"])


def test_event_json_roundtrip():
    event = make_tick_event()

    data = json.loads(event_to_json(event))
    restored = event_from_dict(data)

    assert isinstance(restored, TickEvent)
    assert restored.symbol == event.symbol
    assert restored.ltp == event.ltp
    assert restored.event_id == event.event_id


def test_unknown_event_type_raises():
    with pytest.raises(ValueError):
        event_from_dict({"event_type": "UNKNOWN"})


def test_signal_event_strength_range_valid():
    event = SignalEvent(
        symbol="SBIN",
        strategy_name="mean-reversion",
        action="BUY",
        strength=0.7,
        reason="below vwap",
        ltp=750.5,
        indicators={"vwap": 749.9},
        source_tick_event_id="tick-1",
    )

    assert event.strength == 0.7


def test_signal_event_strength_invalid_raises():
    with pytest.raises(ValueError):
        SignalEvent(
            symbol="SBIN",
            strategy_name="mean-reversion",
            action="BUY",
            strength=1.5,
            reason="invalid",
            ltp=750.5,
            indicators={},
            source_tick_event_id=None,
        )


def test_order_request_links_to_signal():
    signal = SignalEvent(
        symbol="SBIN",
        strategy_name="mean-reversion",
        action="BUY",
        strength=0.8,
        reason="signal",
        ltp=750.5,
        indicators={},
        source_tick_event_id=None,
    )
    order = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        order_type="MARKET",
        price=None,
        strategy_name="mean-reversion",
        signal_event_id=signal.event_id,
        trading_mode="PAPER",
        source="STRATEGY",
    )

    assert order.signal_event_id == signal.event_id


def test_order_request_invalid_quantity_raises():
    with pytest.raises(ValueError):
        OrderRequestEvent(
            symbol="SBIN",
            side="BUY",
            quantity=0,
            order_type="MARKET",
            price=None,
            strategy_name="mean-reversion",
            signal_event_id=None,
            trading_mode="PAPER",
            source="STRATEGY",
        )


def test_order_state_links_to_request():
    order = OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        order_type="MARKET",
        price=None,
        strategy_name="mean-reversion",
        signal_event_id=None,
        trading_mode="PAPER",
        source="STRATEGY",
    )
    state = OrderStateEvent(
        order_id="internal-1",
        broker_order_id=None,
        symbol="SBIN",
        side="BUY",
        quantity=10,
        filled_quantity=0,
        avg_fill_price=None,
        status="PENDING",
        reject_reason=None,
        order_request_id=order.event_id,
    )

    assert state.order_request_id == order.event_id


@pytest.mark.asyncio
async def test_event_bus_single_subscriber():
    bus = EventBus()
    received = []

    async def handler(event):
        received.append(event)

    bus.subscribe(EventType.TICK.value, handler)
    event = make_tick_event()
    await bus.publish(event)

    assert received == [event]


@pytest.mark.asyncio
async def test_event_bus_multiple_subscribers():
    bus = EventBus()
    received = []

    async def first(event):
        received.append(("first", event.event_id))

    async def second(event):
        received.append(("second", event.event_id))

    bus.subscribe(EventType.TICK.value, first)
    bus.subscribe(EventType.TICK.value, second)
    event = make_tick_event()
    await bus.publish(event)

    assert ("first", event.event_id) in received
    assert ("second", event.event_id) in received


@pytest.mark.asyncio
async def test_event_bus_handler_exception_does_not_stop_others():
    bus = EventBus()
    received = []

    async def broken(event):
        raise RuntimeError("handler failed")

    async def healthy(event):
        received.append(event.event_id)

    bus.subscribe(EventType.TICK.value, broken)
    bus.subscribe(EventType.TICK.value, healthy)
    event = make_tick_event()
    await bus.publish(event)

    assert received == [event.event_id]
    assert bus.get_stats()["failed_handler_count"] == 1


@pytest.mark.asyncio
async def test_event_bus_filters_by_type():
    bus = EventBus()
    await bus.publish(make_tick_event())
    await bus.publish(LogEvent(level="INFO", component="test", message="hello"))

    recent = bus.get_recent(event_type=EventType.LOG.value)

    assert len(recent) == 1
    assert recent[0]["event_type"] == EventType.LOG.value


@pytest.mark.asyncio
async def test_event_bus_wildcard_subscriber_receives_all():
    bus = EventBus()
    received = []

    async def wildcard(event):
        received.append(event.event_type)

    bus.subscribe("*", wildcard)
    await bus.publish(make_tick_event())
    await bus.publish(LogEvent(level="INFO", component="test", message="hello"))

    assert received == [EventType.TICK.value, EventType.LOG.value]


@pytest.mark.asyncio
async def test_event_bus_history_serialized_recent():
    bus = EventBus()
    await bus.publish(make_tick_event())

    recent = bus.get_recent()

    assert len(recent) == 1
    assert recent[0]["event_type"] == EventType.TICK.value
    assert isinstance(recent[0]["occurred_at"], str)


@pytest.mark.asyncio
async def test_event_bus_stats_counts_by_type():
    bus = EventBus()
    await bus.publish(make_tick_event())
    await bus.publish(LogEvent(level="INFO", component="test", message="hello"))

    stats = bus.get_stats()

    assert stats["total"] == 2
    assert stats["by_type"][EventType.TICK.value] == 1
    assert stats["by_type"][EventType.LOG.value] == 1


@pytest.mark.asyncio
async def test_event_bus_clear_history_does_not_reset_counters():
    bus = EventBus()
    await bus.publish(make_tick_event())

    bus.clear_history()

    assert bus.get_recent() == []
    assert bus.get_stats()["total"] == 1
