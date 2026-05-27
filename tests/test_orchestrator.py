import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from types import SimpleNamespace

from backend.core.orchestrator import SystemOrchestrator
from backend.core.event_bus import EventBus
from backend.core.types import TradingMode

def test_orchestrator_imports():
    """Module import verification."""
    from backend.core.orchestrator import SystemOrchestrator
    assert SystemOrchestrator is not None

@pytest.mark.asyncio
async def test_orchestrator_startup_sets_state():
    """Initializes flags and internal component states correctly."""
    broadcaster = MagicMock()
    broadcaster.start = MagicMock()
    broadcaster.broadcast = AsyncMock()
    
    event_bus = EventBus()
    
    candle_store = MagicMock()
    candle_store.on_tick_event = AsyncMock()
    
    indicator_engine = MagicMock()
    backtest_engine = MagicMock()
    market_watch = MagicMock()
    portfolio = MagicMock()
    risk = MagicMock()
    strategy = MagicMock()
    
    portfolio_engine = MagicMock()
    portfolio_engine.on_order_state_event = AsyncMock()
    
    router = MagicMock()
    router.recover_from_store.return_value = 0
    router.kill_switch = MagicMock()
    
    instrument_loader = MagicMock()
    instrument_loader.load = AsyncMock(return_value=[])
    instrument_loader.meta_path = MagicMock()
    instrument_loader.meta_path.exists.return_value = False
    
    market_board = MagicMock()
    screener_engine = MagicMock()
    obs_metrics = MagicMock()
    obs_event_log = MagicMock()
    obs_timeline = MagicMock()
    
    orch = SystemOrchestrator(
        broadcaster=broadcaster,
        event_bus=event_bus,
        candle_store=candle_store,
        indicator_engine=indicator_engine,
        backtest_engine=backtest_engine,
        market_watch=market_watch,
        portfolio=portfolio,
        risk=risk,
        strategy=strategy,
        portfolio_engine=portfolio_engine,
        router=router,
        instrument_loader=instrument_loader,
        market_board=market_board,
        screener_engine=screener_engine,
        obs_metrics=obs_metrics,
        obs_event_log=obs_event_log,
        obs_timeline=obs_timeline,
        execution_mode="PAPER"
    )
    
    app_state = MagicMock()
    await orch.startup(app_state)
    
    broadcaster.start.assert_called_once()
    assert orch.sampler_task is not None
    assert not orch.sampler_task.done()
    
    # Clean up sampler task
    orch.sampler_task.cancel()
    try:
        await orch.sampler_task
    except asyncio.CancelledError:
        pass

@pytest.mark.asyncio
async def test_orchestrator_shutdown_cancels_tasks():
    """Correctly cancels downstream worker tasks during teardown."""
    broadcaster = MagicMock()
    event_bus = EventBus()
    
    candle_store = MagicMock()
    candle_store.on_tick_event = AsyncMock()
    
    indicator_engine = MagicMock()
    backtest_engine = MagicMock()
    market_watch = MagicMock()
    portfolio = MagicMock()
    risk = MagicMock()
    strategy = MagicMock()
    
    portfolio_engine = MagicMock()
    portfolio_engine.on_order_state_event = AsyncMock()
    
    router = MagicMock()
    router.kill_switch = MagicMock()
    
    instrument_loader = MagicMock()
    market_board = MagicMock()
    screener_engine = MagicMock()
    obs_metrics = MagicMock()
    obs_event_log = MagicMock()
    obs_timeline = MagicMock()
    
    orch = SystemOrchestrator(
        broadcaster=broadcaster,
        event_bus=event_bus,
        candle_store=candle_store,
        indicator_engine=indicator_engine,
        backtest_engine=backtest_engine,
        market_watch=market_watch,
        portfolio=portfolio,
        risk=risk,
        strategy=strategy,
        portfolio_engine=portfolio_engine,
        router=router,
        instrument_loader=instrument_loader,
        market_board=market_board,
        screener_engine=screener_engine,
        obs_metrics=obs_metrics,
        obs_event_log=obs_event_log,
        obs_timeline=obs_timeline,
        execution_mode="PAPER"
    )
    
    async def dummy_sampler():
        while True:
            await asyncio.sleep(1)
            
    orch.sampler_task = asyncio.create_task(dummy_sampler())
    
    await orch.shutdown()
    
    assert orch.sampler_task.cancelled() or orch.sampler_task.done()

@pytest.mark.asyncio
async def test_tick_loop_survives_bad_tick():
    """System handles/logs bad ticks without loop crash."""
    broadcaster = MagicMock()
    broadcaster.broadcast = AsyncMock()
    
    event_bus = EventBus()
    
    candle_store = MagicMock()
    candle_store.on_tick_event = AsyncMock()
    
    indicator_engine = MagicMock()
    backtest_engine = MagicMock()
    market_watch = MagicMock()
    portfolio = MagicMock()
    risk = MagicMock()
    strategy = MagicMock()
    
    portfolio_engine = MagicMock()
    portfolio_engine.on_order_state_event = AsyncMock()
    
    router = MagicMock()
    router.kill_switch = MagicMock()
    
    instrument_loader = MagicMock()
    market_board = MagicMock()
    screener_engine = MagicMock()
    obs_metrics = MagicMock()
    obs_event_log = MagicMock()
    obs_timeline = MagicMock()
    
    orch = SystemOrchestrator(
        broadcaster=broadcaster,
        event_bus=event_bus,
        candle_store=candle_store,
        indicator_engine=indicator_engine,
        backtest_engine=backtest_engine,
        market_watch=market_watch,
        portfolio=portfolio,
        risk=risk,
        strategy=strategy,
        portfolio_engine=portfolio_engine,
        router=router,
        instrument_loader=instrument_loader,
        market_board=market_board,
        screener_engine=screener_engine,
        obs_metrics=obs_metrics,
        obs_event_log=obs_event_log,
        obs_timeline=obs_timeline,
        execution_mode="PAPER"
    )
    
    tick_bus = MagicMock()
    bad_tick = {"event_type": "tick", "symbol": None, "ltp": None}
    good_tick = {"event_type": "tick", "symbol": "SBIN", "ltp": 750.0, "vwap": 750.0}
    
    queue = [bad_tick, good_tick]
    
    async def get_mock():
        if queue:
            return queue.pop(0)
        raise asyncio.CancelledError()
        
    tick_bus.get = get_mock
    orch.tick_bus = tick_bus
    
    market_watch.update_tick = MagicMock()
    strategy.generate_signal.return_value = SimpleNamespace(action="BUY")
    
    await orch.consume_tick_bus()
    
    assert market_watch.update_tick.call_count == 2

@pytest.mark.asyncio
async def test_tick_loop_survives_keyboard_interrupt_style_cancel():
    """Gracefully exits on cancellation."""
    broadcaster = MagicMock()
    event_bus = EventBus()
    
    candle_store = MagicMock()
    candle_store.on_tick_event = AsyncMock()
    
    indicator_engine = MagicMock()
    backtest_engine = MagicMock()
    market_watch = MagicMock()
    portfolio = MagicMock()
    risk = MagicMock()
    strategy = MagicMock()
    
    portfolio_engine = MagicMock()
    portfolio_engine.on_order_state_event = AsyncMock()
    
    router = MagicMock()
    router.kill_switch = MagicMock()
    
    instrument_loader = MagicMock()
    market_board = MagicMock()
    screener_engine = MagicMock()
    obs_metrics = MagicMock()
    obs_event_log = MagicMock()
    obs_timeline = MagicMock()
    
    orch = SystemOrchestrator(
        broadcaster=broadcaster,
        event_bus=event_bus,
        candle_store=candle_store,
        indicator_engine=indicator_engine,
        backtest_engine=backtest_engine,
        market_watch=market_watch,
        portfolio=portfolio,
        risk=risk,
        strategy=strategy,
        portfolio_engine=portfolio_engine,
        router=router,
        instrument_loader=instrument_loader,
        market_board=market_board,
        screener_engine=screener_engine,
        obs_metrics=obs_metrics,
        obs_event_log=obs_event_log,
        obs_timeline=obs_timeline,
        execution_mode="PAPER"
    )
    
    tick_bus = MagicMock()
    
    async def get_mock():
        raise asyncio.CancelledError()
        
    tick_bus.get = get_mock
    orch.tick_bus = tick_bus
    
    await orch.consume_tick_bus()
