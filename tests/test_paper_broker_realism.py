"""tests/test_paper_broker_realism.py

Phase 18K — Paper broker realism tests.

Tests:
 1.  Market closed rejects paper MARKET order (MARKET_CLOSED).
 2.  After-hours allowed flag permits paper order.
 3.  Missing reference price rejects with NO_MARKET_PRICE.
 4.  Invalid quantity raises ValueError at construction (OrderRequestEvent guard).
 5.  Invalid side raises ValueError at construction (OrderRequestEvent guard).
 6.  Market BUY applies positive slippage (fill > ref).
 7.  Market SELL applies negative slippage (fill < ref).
 8.  Paper fees are calculated and persisted to fill ledger.
 9.  BUY limit not crossed remains OPEN, no fill row.
10.  SELL limit not crossed remains OPEN, no fill row.
11.  Marketable BUY limit fills deterministically at conservative price.
12.  Marketable SELL limit fills deterministically at conservative price.
13.  Rejection reason persists to order store/audit event.
14.  Successful paper fill records one fill row only.
15.  Repeated execution does not duplicate fill ledger row.
16.  Market order with zero ref price rejects (NO_MARKET_PRICE).
17.  Weekend date blocks paper market order (MARKET_CLOSED).
18.  Exact session boundary: 09:15 passes, 09:14 rejected.
19.  Exact session boundary: 15:30 passes, 15:31 rejected.
20.  PaperExecutionConfig slippage_factor correct for BUY and SELL.
21.  PaperExecutionConfig allow_after_hours bypasses market hours.
22.  Limit order with None price rejects (NO_MARKET_PRICE).
23.  Market order with "price" key fallback fills correctly.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
import uuid
from datetime import datetime, timezone, timedelta

import pytest

from backend.core.events import OrderRequestEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.execution.order_state_machine import OrderStateMachine
from backend.execution.order_store import OrderStore
from backend.execution.paper_execution_config import PaperExecutionConfig
from backend.execution.paper_order_manager import PaperOrderManager, PaperRejectReason

# ---------------------------------------------------------------------------
# IST offset helper
# ---------------------------------------------------------------------------
_IST = timezone(timedelta(hours=5, minutes=30))


def _ist(h: int, m: int, weekday: int = 0) -> datetime:
    """Return a weekday IST datetime at hour:minute.

    weekday: 0=Mon … 6=Sun.  Base date: 2026-03-02 (Monday).
    """
    base = datetime(2026, 3, 2, h, m, 0, tzinfo=_IST)
    return base + timedelta(days=weekday)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def temp_store():
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    store = OrderStore(f.name)
    yield store
    try:
        os.unlink(f.name)
    except FileNotFoundError:
        pass


def _make_manager(
    config: PaperExecutionConfig = None,
    now_fn=None,
    store: OrderStore = None,
) -> PaperOrderManager:
    osm = OrderStateMachine()
    return PaperOrderManager(
        order_state_machine=osm,
        order_store=store,
        config=config or PaperExecutionConfig(market_hours_enforced=False),
        _now_fn=now_fn,
    )


def _mkt_request(
    side: str = "BUY",
    qty: int = 10,
    symbol: str = "RELIANCE",
) -> OrderRequestEvent:
    return OrderRequestEvent(
        symbol=symbol,
        side=side,
        quantity=qty,
        order_type=OrderType.MARKET.value,
        price=None,
        strategy_name="test_strategy",
        signal_event_id=None,
        trading_mode=TradingMode.PAPER.value,
        source="test",
    )


def _limit_request(
    side: str = "BUY",
    qty: int = 10,
    price: float = 500.0,
    symbol: str = "SBIN",
) -> OrderRequestEvent:
    return OrderRequestEvent(
        symbol=symbol,
        side=side,
        quantity=qty,
        order_type=OrderType.LIMIT.value,
        price=price,
        strategy_name="test_strategy",
        signal_event_id=None,
        trading_mode=TradingMode.PAPER.value,
        source="test",
    )


def _seed_pending(store: OrderStore, event_id: str, symbol: str, side: str, qty: int, order_type: str) -> None:
    """Insert a PENDING row so the fill ledger can reference it."""
    store.add_order_request(
        request_id=event_id,
        client_order_id=event_id,
        idempotency_key=event_id,
        symbol=symbol,
        side=side,
        quantity=qty,
        order_type=order_type,
        mode="PAPER",
        status="PENDING",
    )


# ---------------------------------------------------------------------------
# Test 1: Market closed → MARKET_CLOSED
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_market_closed_rejects_order():
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=False)
    mgr = _make_manager(config=cfg, now_fn=lambda: _ist(8, 0, weekday=0))
    req = _mkt_request()
    event = await mgr.place_order(req, {"ltp": 2500.0})
    assert event.status == OrderStatus.REJECTED.value
    assert event.reject_reason == PaperRejectReason.MARKET_CLOSED


# ---------------------------------------------------------------------------
# Test 2: After-hours allowed → FILLED
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_after_hours_allowed_flag_permits_order():
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=True)
    mgr = _make_manager(config=cfg, now_fn=lambda: _ist(8, 0, weekday=0))
    req = _mkt_request()
    event = await mgr.place_order(req, {"ltp": 2500.0})
    assert event.status == OrderStatus.FILLED.value


# ---------------------------------------------------------------------------
# Test 3: Missing price → NO_MARKET_PRICE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_reference_price_rejects():
    mgr = _make_manager()
    req = _mkt_request()
    event = await mgr.place_order(req, {})
    assert event.status == OrderStatus.REJECTED.value
    assert event.reject_reason == PaperRejectReason.NO_MARKET_PRICE


# ---------------------------------------------------------------------------
# Test 4: Invalid quantity → ValueError at construction
# ---------------------------------------------------------------------------

def test_invalid_quantity_raises_at_construction():
    with pytest.raises(ValueError, match="quantity"):
        OrderRequestEvent(
            symbol="SBIN", side="BUY", quantity=0,
            order_type=OrderType.MARKET.value, price=None,
            strategy_name="t", signal_event_id=None,
            trading_mode=TradingMode.PAPER.value, source="test",
        )


# ---------------------------------------------------------------------------
# Test 5: Invalid side → ValueError at construction
# ---------------------------------------------------------------------------

def test_invalid_side_raises_at_construction():
    with pytest.raises(ValueError, match="side"):
        OrderRequestEvent(
            symbol="SBIN", side="HOLD", quantity=10,
            order_type=OrderType.MARKET.value, price=None,
            strategy_name="t", signal_event_id=None,
            trading_mode=TradingMode.PAPER.value, source="test",
        )


# ---------------------------------------------------------------------------
# Test 6: Market BUY applies positive slippage
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_market_buy_applies_positive_slippage():
    cfg = PaperExecutionConfig(slippage_bps=10, market_hours_enforced=False)
    mgr = _make_manager(config=cfg)
    ref = 1000.0
    req = _mkt_request(side="BUY")
    event = await mgr.place_order(req, {"ltp": ref})
    assert event.status == OrderStatus.FILLED.value
    expected = round(ref * (1 + 10 / 10_000), 2)
    assert event.avg_fill_price == expected
    assert event.avg_fill_price > ref


# ---------------------------------------------------------------------------
# Test 7: Market SELL applies negative slippage
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_market_sell_applies_negative_slippage():
    cfg = PaperExecutionConfig(slippage_bps=10, market_hours_enforced=False)
    mgr = _make_manager(config=cfg)
    ref = 1000.0
    req = _mkt_request(side="SELL")
    event = await mgr.place_order(req, {"ltp": ref})
    assert event.status == OrderStatus.FILLED.value
    expected = round(ref * (1 - 10 / 10_000), 2)
    assert event.avg_fill_price == expected
    assert event.avg_fill_price < ref


# ---------------------------------------------------------------------------
# Test 8: Fees persisted to fill ledger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fees_persisted_to_fill_ledger(temp_store):
    cfg = PaperExecutionConfig(market_hours_enforced=False)
    mgr = _make_manager(config=cfg, store=temp_store)
    req = _mkt_request(side="BUY", qty=100)
    _seed_pending(temp_store, req.event_id, "RELIANCE", "BUY", 100, "MARKET")

    event = await mgr.place_order(req, {"ltp": 2500.0})
    assert event.status == OrderStatus.FILLED.value

    fills = temp_store.get_fills_for_request(req.event_id)
    assert len(fills) == 1
    fill = fills[0]
    assert fill["fees"] > 0.0
    assert fill["fill_price"] > 2500.0  # slippage on BUY


# ---------------------------------------------------------------------------
# Test 9: BUY limit not crossed → OPEN, no fill row
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_buy_limit_not_crossed_stays_open(temp_store):
    cfg = PaperExecutionConfig(market_hours_enforced=False)
    mgr = _make_manager(config=cfg, store=temp_store)
    # Limit 490 < ref 500 → BUY limit not crossed
    req = _limit_request(side="BUY", price=490.0)
    _seed_pending(temp_store, req.event_id, "SBIN", "BUY", 10, "LIMIT")
    event = await mgr.place_order(req, {"ltp": 500.0})
    assert event.status == OrderStatus.OPEN.value
    fills = temp_store.get_fills_for_request(req.event_id)
    assert fills == []


# ---------------------------------------------------------------------------
# Test 10: SELL limit not crossed → OPEN, no fill row
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sell_limit_not_crossed_stays_open(temp_store):
    cfg = PaperExecutionConfig(market_hours_enforced=False)
    mgr = _make_manager(config=cfg, store=temp_store)
    # Limit 510 > ref 500 → SELL limit not crossed
    req = _limit_request(side="SELL", price=510.0)
    _seed_pending(temp_store, req.event_id, "SBIN", "SELL", 10, "LIMIT")
    event = await mgr.place_order(req, {"ltp": 500.0})
    assert event.status == OrderStatus.OPEN.value
    fills = temp_store.get_fills_for_request(req.event_id)
    assert fills == []


# ---------------------------------------------------------------------------
# Test 11: Marketable BUY limit fills at conservative price
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_marketable_buy_limit_fills_conservatively(temp_store):
    cfg = PaperExecutionConfig(slippage_bps=10, market_hours_enforced=False)
    mgr = _make_manager(config=cfg, store=temp_store)
    ref = 500.0
    limit = 520.0  # limit >= ref → marketable BUY
    req = _limit_request(side="BUY", price=limit)
    _seed_pending(temp_store, req.event_id, "SBIN", "BUY", 10, "LIMIT")

    event = await mgr.place_order(req, {"ltp": ref})
    assert event.status == OrderStatus.FILLED.value
    # Conservative: fill = min(limit_price, ref * slip_factor)
    slip_price = round(ref * (1 + 10 / 10_000), 2)
    expected_fill = min(limit, slip_price)
    assert event.avg_fill_price == expected_fill
    fills = temp_store.get_fills_for_request(req.event_id)
    assert len(fills) == 1


# ---------------------------------------------------------------------------
# Test 12: Marketable SELL limit fills at conservative price
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_marketable_sell_limit_fills_conservatively(temp_store):
    cfg = PaperExecutionConfig(slippage_bps=10, market_hours_enforced=False)
    mgr = _make_manager(config=cfg, store=temp_store)
    ref = 500.0
    limit = 480.0  # limit <= ref → marketable SELL
    req = _limit_request(side="SELL", price=limit)
    _seed_pending(temp_store, req.event_id, "SBIN", "SELL", 10, "LIMIT")

    event = await mgr.place_order(req, {"ltp": ref})
    assert event.status == OrderStatus.FILLED.value
    # Conservative: fill = max(limit_price, ref * slip_factor)
    slip_price = round(ref * (1 - 10 / 10_000), 2)
    expected_fill = max(limit, slip_price)
    assert event.avg_fill_price == expected_fill
    fills = temp_store.get_fills_for_request(req.event_id)
    assert len(fills) == 1


# ---------------------------------------------------------------------------
# Test 13: Rejection reason persists to order events
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rejection_reason_persists_to_audit(temp_store):
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=False)
    mgr = _make_manager(config=cfg, now_fn=lambda: _ist(8, 0, weekday=0), store=temp_store)
    req = _mkt_request()
    _seed_pending(temp_store, req.event_id, "RELIANCE", "BUY", 10, "MARKET")

    event = await mgr.place_order(req, {"ltp": 2500.0})
    assert event.status == OrderStatus.REJECTED.value
    assert event.reject_reason == PaperRejectReason.MARKET_CLOSED

    events = temp_store.get_order_events(req.event_id)
    reasons = [e["reason"] for e in events if e.get("reason")]
    assert PaperRejectReason.MARKET_CLOSED in reasons


# ---------------------------------------------------------------------------
# Test 14: Successful fill records one fill row only
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_successful_fill_records_one_row(temp_store):
    cfg = PaperExecutionConfig(market_hours_enforced=False)
    mgr = _make_manager(config=cfg, store=temp_store)
    req = _mkt_request()
    _seed_pending(temp_store, req.event_id, "RELIANCE", "BUY", 10, "MARKET")

    event = await mgr.place_order(req, {"ltp": 2500.0})
    assert event.status == OrderStatus.FILLED.value
    fills = temp_store.get_fills_for_request(req.event_id)
    assert len(fills) == 1


# ---------------------------------------------------------------------------
# Test 15: Repeated execution does not duplicate fill row
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_repeated_execution_no_duplicate_fill(temp_store):
    cfg = PaperExecutionConfig(market_hours_enforced=False)
    req = _mkt_request()
    _seed_pending(temp_store, req.event_id, "RELIANCE", "BUY", 10, "MARKET")

    mgr1 = _make_manager(config=cfg, store=temp_store)
    await mgr1.place_order(req, {"ltp": 2500.0})

    # Second manager, same request object → same event_id → same fill_id
    mgr2 = _make_manager(config=cfg, store=temp_store)
    await mgr2.place_order(req, {"ltp": 2500.0})

    fills = temp_store.get_fills_for_request(req.event_id)
    # UNIQUE fill_id constraint: still exactly 1 row
    assert len(fills) == 1


# ---------------------------------------------------------------------------
# Test 16: Zero ref price → NO_MARKET_PRICE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_zero_ref_price_rejects():
    mgr = _make_manager()
    req = _mkt_request()
    event = await mgr.place_order(req, {"ltp": 0.0})
    assert event.status == OrderStatus.REJECTED.value
    assert event.reject_reason == PaperRejectReason.NO_MARKET_PRICE


# ---------------------------------------------------------------------------
# Test 17: Weekend → MARKET_CLOSED
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_weekend_blocks_order():
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=False)
    # weekday=5 → Saturday
    mgr = _make_manager(config=cfg, now_fn=lambda: _ist(10, 0, weekday=5))
    req = _mkt_request()
    event = await mgr.place_order(req, {"ltp": 500.0})
    assert event.status == OrderStatus.REJECTED.value
    assert event.reject_reason == PaperRejectReason.MARKET_CLOSED


# ---------------------------------------------------------------------------
# Test 18: Session boundary 09:15 passes, 09:14 rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_session_boundary_open():
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=False)

    mgr_ok = _make_manager(config=cfg, now_fn=lambda: _ist(9, 15, weekday=0))
    event_ok = await mgr_ok.place_order(_mkt_request(), {"ltp": 500.0})
    assert event_ok.status == OrderStatus.FILLED.value

    mgr_bad = _make_manager(config=cfg, now_fn=lambda: _ist(9, 14, weekday=0))
    event_bad = await mgr_bad.place_order(_mkt_request(), {"ltp": 500.0})
    assert event_bad.status == OrderStatus.REJECTED.value
    assert event_bad.reject_reason == PaperRejectReason.MARKET_CLOSED


# ---------------------------------------------------------------------------
# Test 19: Session boundary 15:30 passes, 15:31 rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_session_boundary_close():
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=False)

    mgr_ok = _make_manager(config=cfg, now_fn=lambda: _ist(15, 30, weekday=0))
    event_ok = await mgr_ok.place_order(_mkt_request(), {"ltp": 500.0})
    assert event_ok.status == OrderStatus.FILLED.value

    mgr_bad = _make_manager(config=cfg, now_fn=lambda: _ist(15, 31, weekday=0))
    event_bad = await mgr_bad.place_order(_mkt_request(), {"ltp": 500.0})
    assert event_bad.status == OrderStatus.REJECTED.value
    assert event_bad.reject_reason == PaperRejectReason.MARKET_CLOSED


# ---------------------------------------------------------------------------
# Test 20: PaperExecutionConfig slippage_factor correctness
# ---------------------------------------------------------------------------

def test_slippage_factor_correctness():
    cfg = PaperExecutionConfig(slippage_bps=5)
    assert cfg.slippage_factor("BUY")  == pytest.approx(1.0005)
    assert cfg.slippage_factor("SELL") == pytest.approx(0.9995)

    cfg2 = PaperExecutionConfig(slippage_bps=10)
    assert cfg2.slippage_factor("BUY")  == pytest.approx(1.001)
    assert cfg2.slippage_factor("SELL") == pytest.approx(0.999)


# ---------------------------------------------------------------------------
# Test 21: allow_after_hours bypasses market_hours_enforced
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_allow_after_hours_bypasses_enforcement():
    cfg = PaperExecutionConfig(market_hours_enforced=True, allow_after_hours=True)
    # Sunday 02:00 IST — would be rejected without allow_after_hours
    mgr = _make_manager(config=cfg, now_fn=lambda: _ist(2, 0, weekday=6))
    event = await mgr.place_order(_mkt_request(), {"ltp": 500.0})
    assert event.status == OrderStatus.FILLED.value


# ---------------------------------------------------------------------------
# Test 22: Limit order with None price → NO_MARKET_PRICE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_limit_order_none_price_rejects():
    mgr = _make_manager()
    req = OrderRequestEvent(
        symbol="SBIN", side="BUY", quantity=10,
        order_type=OrderType.LIMIT.value,
        price=None,
        strategy_name="t", signal_event_id=None,
        trading_mode=TradingMode.PAPER.value, source="test",
    )
    event = await mgr.place_order(req, {"ltp": 500.0})
    assert event.status == OrderStatus.REJECTED.value
    assert event.reject_reason == PaperRejectReason.NO_MARKET_PRICE


# ---------------------------------------------------------------------------
# Test 23: Market order with "price" key fallback fills correctly
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_market_order_uses_price_key_fallback():
    cfg = PaperExecutionConfig(slippage_bps=0, market_hours_enforced=False)
    mgr = _make_manager(config=cfg)
    req = _mkt_request(side="BUY")
    event = await mgr.place_order(req, {"price": 750.0})
    assert event.status == OrderStatus.FILLED.value
    assert event.avg_fill_price == 750.0  # 0 bps slippage → exact ref price
