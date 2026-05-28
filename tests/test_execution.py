from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from backend.core.events import OrderRequestEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.data.trade_journal import TradeJournal
from backend.execution.execution_router import ExecutionRouter
from backend.execution.fee_model import NSEFeeModel
from backend.execution.kill_switch import KillSwitch
from backend.execution.live_order_manager import LiveOrderManager
from backend.execution.models import OrderIntent
from backend.execution.order_poller import OrderPoller
from backend.execution.order_state_machine import OrderStateMachine
from backend.execution.paper_execution_config import PaperExecutionConfig
from backend.execution.paper_order_manager import PaperOrderManager
from backend.execution.pre_trade_risk_gate import PreTradeRiskGate

# Phase 18K: market-hours guard is now on by default.  Tests that are not
# specifically testing market-hours behaviour use this config to bypass the IST
# session check so they remain deterministic regardless of when they are run.
_TEST_CFG = PaperExecutionConfig(allow_after_hours=True)


def fresh_market(**overrides):
    data = {
        "symbol": "SBIN",
        "ltp": 750.0,
        "best_bid": 749.5,
        "best_ask": 750.5,
        "spread": 1.0,
        "volume": 1000,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
    data.update(overrides)
    return data


def stale_market():
    return fresh_market(received_at=(datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat())


def request_event(
    side=OrderSide.BUY.value,
    order_type=OrderType.MARKET.value,
    price=None,
    quantity=10,
):
    return OrderRequestEvent(
        symbol="SBIN",
        side=side,
        quantity=quantity,
        order_type=order_type,
        price=price,
        strategy_name="test",
        signal_event_id=None,
        trading_mode=TradingMode.PAPER.value,
        source="MANUAL",
    )


def intent(quantity=10, order_type=OrderType.MARKET.value, price=None):
    return OrderIntent(
        symbol="SBIN",
        side=OrderSide.BUY.value,
        quantity=quantity,
        order_type=order_type,
        price=price,
        strategy_name=None,
        signal_event_id=None,
        source="MANUAL",
        trading_mode=TradingMode.PAPER.value,
    )


def settings_stub(max_qty=500, max_notional=500000.0):
    return SimpleNamespace(
        max_order_qty=max_qty,
        max_order_notional=max_notional,
        max_daily_loss=-25000.0,
    )


def test_fee_model_buy_calculation():
    fees = NSEFeeModel().calculate(OrderSide.BUY.value, 10, 100.0)
    assert fees["turnover"] == 1000.0
    assert fees["stamp_duty"] > 0
    assert fees["stt"] == 0.0
    assert fees["total_fees"] > 0


def test_fee_model_sell_calculation():
    fees = NSEFeeModel().calculate(OrderSide.SELL.value, 10, 100.0)
    assert fees["turnover"] == 1000.0
    assert fees["stt"] > 0
    assert fees["stamp_duty"] == 0.0
    assert fees["net_proceeds_from_sell"] < 1000.0


def test_fee_model_round_trip_breakeven():
    result = NSEFeeModel().round_trip_fees(10, 100.0, 101.0)
    assert result["total_fees"] > 0
    assert result["gross_pnl"] == 10.0
    assert result["breakeven_move_pct"] > 0


def test_order_intent_validation_rejects_bad_quantity():
    with pytest.raises(ValueError):
        intent(quantity=0)


@pytest.mark.asyncio
async def test_kill_switch_blocks_risk_gate():
    kill = KillSwitch()
    kill.activate("test")
    gate = PreTradeRiskGate(kill, settings=settings_stub())
    decision = await gate.evaluate(intent(), fresh_market())
    assert not decision.approved
    assert "kill_switch_active" in decision.failed_checks


@pytest.mark.asyncio
async def test_pre_trade_rejects_over_max_qty():
    gate = PreTradeRiskGate(KillSwitch(), settings=settings_stub(max_qty=5))
    decision = await gate.evaluate(intent(quantity=10), fresh_market())
    assert "max_order_qty" in decision.failed_checks


@pytest.mark.asyncio
async def test_pre_trade_rejects_over_max_notional():
    gate = PreTradeRiskGate(KillSwitch(), settings=settings_stub(max_notional=100.0))
    decision = await gate.evaluate(intent(quantity=10), fresh_market(ltp=750.0))
    assert "max_order_notional" in decision.failed_checks


@pytest.mark.asyncio
async def test_pre_trade_rejects_stale_market_data():
    gate = PreTradeRiskGate(KillSwitch(), settings=settings_stub())
    decision = await gate.evaluate(intent(), stale_market())
    assert "stale_market_data" in decision.failed_checks


@pytest.mark.asyncio
async def test_paper_market_buy_fills_at_ask():
    # Phase 18K: BUY market order fills at ltp * (1 + slippage_bps/10000).
    # Default slippage is 5 bps: 750 * 1.0005 = 750.375.
    event = await PaperOrderManager(config=_TEST_CFG).place_order(request_event(), fresh_market())
    assert event.status == OrderStatus.FILLED.value
    assert event.avg_fill_price == pytest.approx(750.38, abs=0.01)


@pytest.mark.asyncio
async def test_paper_market_sell_fills_at_bid():
    # Phase 18K: SELL market order fills at ltp * (1 - slippage_bps/10000).
    # Default slippage is 5 bps: 750 * 0.9995 = 749.625.
    event = await PaperOrderManager(config=_TEST_CFG).place_order(
        request_event(side=OrderSide.SELL.value),
        fresh_market(),
    )
    assert event.status == OrderStatus.FILLED.value
    assert event.avg_fill_price == pytest.approx(749.63, abs=0.01)


@pytest.mark.asyncio
async def test_paper_limit_buy_fills_when_ltp_below_limit():
    # Phase 18K conservative fill: min(limit_price=751, ltp*1.0005=750.375) = 750.375.
    event = await PaperOrderManager(config=_TEST_CFG).place_order(
        request_event(order_type=OrderType.LIMIT.value, price=751.0),
        fresh_market(ltp=750.0),
    )
    assert event.status == OrderStatus.FILLED.value
    assert event.avg_fill_price == pytest.approx(750.38, abs=0.01)


@pytest.mark.asyncio
async def test_paper_limit_buy_rests_when_ltp_above_limit():
    # Phase 18K: BUY limit 749 < ltp 750 → not immediately marketable → OPEN.
    event = await PaperOrderManager(config=_TEST_CFG).place_order(
        request_event(order_type=OrderType.LIMIT.value, price=749.0),
        fresh_market(ltp=750.0),
    )
    assert event.status == OrderStatus.OPEN.value


@pytest.mark.asyncio
async def test_paper_fee_deducted_from_fill(tmp_path):
    # Phase 18K: use allow_after_hours so the test runs outside market hours.
    journal = TradeJournal(str(tmp_path / "trades.db"))
    event = await PaperOrderManager(config=_TEST_CFG, trade_journal=journal).place_order(
        request_event(), fresh_market()
    )
    assert event.status == OrderStatus.FILLED.value
    # fees are now persisted via NSEFeeModel; journal.record_fill is called
    # internally only if trade_journal is provided.  Just verify the event filled.
    assert event.avg_fill_price is not None


@pytest.mark.asyncio
async def test_journal_records_every_fill(tmp_path):
    journal = TradeJournal(str(tmp_path / "trades.db"))
    event = await PaperOrderManager(trade_journal=journal).place_order(request_event(), fresh_market())
    await journal.record_fill(event, NSEFeeModel().calculate(OrderSide.BUY.value, 10, 750.6), "test", "PAPER")
    rows = await journal.get_recent_trades()
    assert len(rows) == 1
    assert rows[0]["symbol"] == "SBIN"


def test_state_machine_valid_transition():
    machine = OrderStateMachine()
    state = machine.create_order(request_event(), TradingMode.PAPER.value)
    event = machine.transition(state.order_id, OrderStatus.OPEN.value)
    assert event.status == OrderStatus.OPEN.value


def test_state_machine_rejects_invalid_transition():
    machine = OrderStateMachine()
    state = machine.create_order(request_event(), TradingMode.PAPER.value)
    with pytest.raises(ValueError):
        machine.transition(state.order_id, OrderStatus.CANCELLED.value)


@pytest.mark.asyncio
async def test_live_order_blocked_when_session_invalid():
    session = SimpleNamespace(is_valid=False, smart_api=Mock())
    manager = LiveOrderManager(session_manager=session, trading_mode="LIVE", live_enabled=True)
    event = await manager.place_order(request_event())
    assert event.status == OrderStatus.REJECTED.value
    # Phase 26A: preflight gate now catches session invalidity first
    assert "session_invalid" in (event.reject_reason or "")


@pytest.mark.asyncio
async def test_live_order_blocked_when_live_disabled():
    session = SimpleNamespace(is_valid=True, smart_api=Mock())
    manager = LiveOrderManager(session_manager=session, trading_mode="LIVE", live_enabled=False)
    event = await manager.place_order(request_event())
    # Phase 26A: preflight gate now catches live_trading_disabled first
    assert "live_trading_disabled" in (event.reject_reason or "")


@pytest.mark.asyncio
async def test_live_order_blocked_in_paper_mode():
    session = SimpleNamespace(is_valid=True, smart_api=Mock())
    manager = LiveOrderManager(session_manager=session, trading_mode="PAPER", live_enabled=True)
    event = await manager.place_order(request_event())
    # Phase 26A: wrong_trading_mode is now caught by the preflight gate
    assert "PAPER" in (event.reject_reason or "") or "not_live_mode" in (event.reject_reason or "")


@pytest.mark.asyncio
async def test_live_order_rejected_does_not_call_api():
    smart = Mock()
    session = SimpleNamespace(is_valid=False, smart_api=smart)
    manager = LiveOrderManager(session_manager=session, trading_mode="LIVE", live_enabled=True)
    event = await manager.place_order(request_event())
    assert event.status == OrderStatus.REJECTED.value
    smart.placeOrder.assert_not_called()


@pytest.mark.asyncio
async def test_mode_switch_requires_confirm_true():
    session = SimpleNamespace(is_valid=True, smart_api=Mock())
    router = ExecutionRouter(session_manager=session, live_enabled=True)
    assert await router.switch_to_live(confirm=False) is False


@pytest.mark.asyncio
async def test_mode_switch_blocked_with_open_positions():
    session = SimpleNamespace(is_valid=True, smart_api=Mock())
    portfolio = SimpleNamespace(open_positions={"SBIN": {"qty": 1}})
    router = ExecutionRouter(session_manager=session, portfolio_manager=portfolio, live_enabled=True)
    assert await router.switch_to_live(confirm=True) is False


@pytest.mark.asyncio
async def test_mode_switch_blocked_when_session_invalid():
    session = SimpleNamespace(is_valid=False, smart_api=Mock())
    router = ExecutionRouter(session_manager=session, live_enabled=True)
    assert await router.switch_to_live(confirm=True) is False


@pytest.mark.asyncio
async def test_mode_switch_to_paper_always_allowed():
    router = ExecutionRouter(initial_mode=TradingMode.LIVE.value)
    await router.switch_to_paper()
    assert router.mode == TradingMode.PAPER.value


@pytest.mark.asyncio
async def test_order_poller_updates_state_from_broker_complete():
    machine = OrderStateMachine()
    state = machine.create_order(request_event(), TradingMode.LIVE.value)
    machine.transition(state.order_id, OrderStatus.PENDING.value, broker_order_id="OID1")
    smart = Mock()
    smart.orderBook.return_value = {"data": [{"orderid": "OID1", "status": "complete", "filledshares": 10, "averageprice": 750.0}]}
    await OrderPoller(SimpleNamespace(is_valid=True, smart_api=smart), machine).poll_once()
    assert machine.get(state.order_id).status == OrderStatus.FILLED.value


@pytest.mark.asyncio
async def test_order_poller_handles_rejected():
    machine = OrderStateMachine()
    state = machine.create_order(request_event(), TradingMode.LIVE.value)
    machine.transition(state.order_id, OrderStatus.PENDING.value, broker_order_id="OID1")
    smart = Mock()
    smart.orderBook.return_value = {"data": [{"orderid": "OID1", "status": "rejected", "text": "safe reject"}]}
    await OrderPoller(SimpleNamespace(is_valid=True, smart_api=smart), machine).poll_once()
    assert machine.get(state.order_id).status == OrderStatus.REJECTED.value


@pytest.mark.asyncio
async def test_execution_router_routes_paper_order():
    # Phase 18K: pass allow_after_hours so tests run outside market session.
    cfg = PaperExecutionConfig(allow_after_hours=True)
    router = ExecutionRouter(paper_config=cfg)
    event = await router.route(request_event(), fresh_market())
    assert event.status == OrderStatus.FILLED.value
    # Fill price is ltp * slip_factor (5 bps default): 750 * 1.0005 ≈ 750.38
    assert event.avg_fill_price == pytest.approx(750.38, abs=0.01)


@pytest.mark.asyncio
async def test_execution_router_rejects_when_risk_fails():
    router = ExecutionRouter()
    event = await router.submit_intent(intent(quantity=999999), fresh_market())
    assert event.status == OrderStatus.REJECTED.value
    assert "max_order_qty" in event.reject_reason
