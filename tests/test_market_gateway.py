import asyncio
import logging
from unittest.mock import Mock

import pytest

from backend.gateway import market_gateway as mg
from backend.gateway.market_gateway import MarketDataGateway
from backend.gateway.tick_bus import TickBus


def make_session_manager():
    manager = Mock()
    manager.is_valid = True
    manager.auth_token = "auth-token"
    manager.feed_token = "feed-token"
    return manager


def make_gateway(loop, tick_bus=None):
    return MarketDataGateway(
        session_manager=make_session_manager(),
        tick_bus=tick_bus or TickBus(),
        loop=loop,
    )


async def drain_loop():
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    await asyncio.sleep(0.01)


@pytest.mark.asyncio
async def test_on_open_always_subscribes():
    gateway = make_gateway(asyncio.get_running_loop())
    gateway._sws = Mock()
    gateway._subscription_payload = [{"exchangeType": 1, "tokens": ["3045"]}]

    gateway._on_open(None)
    await drain_loop()

    gateway._sws.subscribe.assert_called_once_with(
        correlation_id="stream0001",
        mode=3,
        token_list=gateway._subscription_payload,
    )


@pytest.mark.asyncio
async def test_reconnect_resubscribes():
    gateway = make_gateway(asyncio.get_running_loop())
    gateway._sws = Mock()
    gateway._subscription_payload = [{"exchangeType": 1, "tokens": ["3045"]}]

    gateway._on_open(None)
    gateway._on_close(None)
    gateway._on_open(None)
    await drain_loop()

    assert gateway._sws.subscribe.call_count == 2
    for call in gateway._sws.subscribe.call_args_list:
        assert call.kwargs["token_list"] == gateway._subscription_payload


@pytest.mark.asyncio
async def test_tick_normalization_paise_to_inr():
    tick_bus = TickBus()
    gateway = make_gateway(asyncio.get_running_loop(), tick_bus)
    gateway._token_symbol_map = {"3045": "SBIN"}

    gateway._on_data(None, {"data": [{"token": "3045", "last_traded_price": 75050}]})
    await drain_loop()

    event = tick_bus.get_nowait()
    assert event["ltp"] == 750.50


@pytest.mark.asyncio
async def test_tick_normalization_all_fields():
    tick_bus = TickBus()
    gateway = make_gateway(asyncio.get_running_loop(), tick_bus)
    gateway._token_symbol_map = {"3045": "SBIN"}
    tick = {
        "token": "3045",
        "last_traded_price": 75050,
        "best_5_buy_data": [{"price": 75040, "quantity": 12}],
        "best_5_sell_data": [{"price": 75060, "quantity": 14}],
        "average_trade_price": 74990,
        "volume_trade_for_the_day": 100000,
        "last_traded_quantity": 25,
        "exchange_timestamp": "2026-05-03T09:15:01",
    }

    gateway._on_data(None, {"data": [tick]})
    await drain_loop()

    event = tick_bus.get_nowait()
    assert event["event_type"] == "tick"
    assert event["symbol"] == "SBIN"
    assert event["token"] == "3045"
    assert event["ltp"] == 750.50
    assert event["best_bid"] == 750.40
    assert event["best_ask"] == 750.60
    assert event["bid_qty"] == 12
    assert event["ask_qty"] == 14
    assert round(event["spread"], 2) == 0.20
    assert event["vwap"] == 749.90
    assert event["volume"] == 100000
    assert event["ltq"] == 25
    assert event["exchange_timestamp"] == "2026-05-03T09:15:01"
    assert event["received_at"]


@pytest.mark.asyncio
async def test_missing_tick_fields_do_not_crash():
    tick_bus = TickBus()
    gateway = make_gateway(asyncio.get_running_loop(), tick_bus)
    gateway._token_symbol_map = {"3045": "SBIN"}

    gateway._on_data(None, {"data": [{"token": "3045"}]})
    await drain_loop()

    event = tick_bus.get_nowait()
    assert event["symbol"] == "SBIN"
    assert event["ltp"] is None
    assert event["best_bid"] is None
    assert event["best_ask"] is None


@pytest.mark.asyncio
async def test_full_queue_drops_tick():
    tick_bus = TickBus(maxsize=1)
    gateway = make_gateway(asyncio.get_running_loop(), tick_bus)
    gateway._token_symbol_map = {"3045": "SBIN"}

    gateway._on_data(None, {"data": [{"token": "3045", "last_traded_price": 1}]})
    gateway._on_data(None, {"data": [{"token": "3045", "last_traded_price": 2}]})
    await drain_loop()

    assert tick_bus.stats()["dropped"] == 1
    assert gateway.dropped_tick_count == 1


@pytest.mark.asyncio
async def test_status_returns_correct_state():
    gateway = make_gateway(asyncio.get_running_loop())
    gateway._sws = Mock()
    gateway._subscription_payload = [{"exchangeType": 1, "tokens": ["3045"]}]

    gateway._on_open(None)
    await drain_loop()

    assert gateway.status()["connection_state"] == "CONNECTED"


@pytest.mark.asyncio
async def test_error_logs_type_only(caplog):
    gateway = make_gateway(asyncio.get_running_loop())

    with caplog.at_level(logging.ERROR):
        gateway._on_error(None, RuntimeError("VERY_SECRET_TOKEN_VALUE"))
    await drain_loop()

    assert "RuntimeError" in caplog.text
    assert "VERY_SECRET_TOKEN_VALUE" not in caplog.text


def test_no_strategy_or_execution_called_from_on_data(monkeypatch):
    loop = Mock()
    tick_bus = Mock()
    tick_bus.put_nowait_safe.return_value = _noop_coro()
    gateway = MarketDataGateway(make_session_manager(), tick_bus, loop)
    gateway._token_symbol_map = {"3045": "SBIN"}
    run_threadsafe = Mock(side_effect=_fake_run_threadsafe)
    monkeypatch.setattr(mg.asyncio, "run_coroutine_threadsafe", run_threadsafe)

    gateway._on_data(None, {"data": [{"token": "3045", "last_traded_price": 75050}]})

    assert run_threadsafe.call_count == 1
    assert tick_bus.put_nowait_safe.call_count == 1
    assert gateway.tick_count == 1


def test_threadsafe_queue_handoff(monkeypatch):
    loop = Mock()
    tick_bus = Mock()
    tick_bus.put_nowait_safe.return_value = _noop_coro()
    gateway = MarketDataGateway(make_session_manager(), tick_bus, loop)
    gateway._token_symbol_map = {"3045": "SBIN"}
    run_threadsafe = Mock(side_effect=_fake_run_threadsafe)
    monkeypatch.setattr(mg.asyncio, "run_coroutine_threadsafe", run_threadsafe)

    gateway._on_data(None, {"data": [{"token": "3045", "last_traded_price": 75050}]})

    assert run_threadsafe.called
    assert run_threadsafe.call_args.args[1] is loop


async def _noop_coro():
    return True


def _fake_run_threadsafe(coro, loop):
    coro.close()
    return _done_future(True)


def _done_future(result):
    future = Mock()
    future.result.return_value = result

    def add_done_callback(callback):
        callback(future)

    future.add_done_callback.side_effect = add_done_callback
    return future
