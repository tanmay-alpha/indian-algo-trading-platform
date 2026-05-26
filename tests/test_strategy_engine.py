import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from backend.engine.strategy_engine import StrategyEngine
from backend.core.orchestrator import SystemOrchestrator

def test_strategy_engine_warmup():
    engine = StrategyEngine(window_size=10)
    # Warmup limit is min(5, window_size) = 5
    for i in range(4):
        signal = engine.update_price("SBIN", 100.0 + i, 100.0)
        assert signal == "NEUTRAL"
    
    # 5th price should trigger evaluation
    signal = engine.update_price("SBIN", 104.0, 100.0)
    # deviation = (104.0 - 100.0) / 100.0 = 0.04 > 0.0015 -> should trigger SELL
    assert signal == "SELL"

def test_strategy_engine_warmup_small_window():
    # If window size is small, e.g. 3, warmup limit is min(5, 3) = 3
    engine = StrategyEngine(window_size=3)
    for i in range(2):
        signal = engine.update_price("SBIN", 100.0 + i, 100.0)
        assert signal == "NEUTRAL"
    
    signal = engine.update_price("SBIN", 103.0, 100.0)
    # deviation = (103.0 - 100.0) / 100.0 = 0.03 > 0.0015 -> should trigger SELL
    assert signal == "SELL"

def test_strategy_engine_vwap_zero():
    engine = StrategyEngine(window_size=10)
    # Feed 5 ticks with VWAP = 0.0
    for i in range(5):
        signal = engine.update_price("SBIN", 100.0 + i, 0.0)
    assert signal == "NEUTRAL"

def test_strategy_engine_vwap_none_fallback():
    engine = StrategyEngine(window_size=10)
    # Feed initial VWAP
    engine.update_price("SBIN", 100.0, 100.0)
    # Subsequent ticks with VWAP = None should fall back to last known VWAP
    for i in range(1, 4):
        signal = engine.update_price("SBIN", 100.0 + i, None)
        assert signal == "NEUTRAL"
    
    # 5th tick
    signal = engine.update_price("SBIN", 105.0, None)
    assert signal == "SELL"

def test_strategy_engine_deviation_signals():
    engine = StrategyEngine(window_size=5)
    
    # Fill up warmup
    for i in range(4):
        engine.update_price("SBIN", 100.0, 100.0)
        
    # Test Bearish deviation (Price far above VWAP -> SELL)
    assert engine.update_price("SBIN", 102.0, 100.0) == "SELL"
    
    # Check that we neutralize near VWAP
    assert engine.update_price("SBIN", 100.01, 100.0) == "NEUTRAL"
    
    # Test Bullish deviation (Price far below VWAP -> BUY)
    assert engine.update_price("SBIN", 97.0, 100.0) == "BUY"

def test_strategy_engine_multi_symbol_isolation():
    """BUG FIX: per-symbol state must not bleed across symbols."""
    engine = StrategyEngine(window_size=10)
    # Feed SBIN prices upward
    for p in [100, 102, 104, 106, 108]:
        engine.update_price("SBIN", p, vwap=101.0)
    # Feed RELIANCE prices downward
    for p in [500, 498, 496, 494, 492]:
        engine.update_price("RELIANCE", p, vwap=499.0)
    
    sbin_signal     = engine.evaluate("SBIN")
    reliance_signal = engine.evaluate("RELIANCE")
    
    # Signals must differ — if state bleeds, both return same value
    # At minimum, RELIANCE prices list must not contain SBIN prices
    sbin_prices     = list(engine._get_prices("SBIN"))
    reliance_prices = list(engine._get_prices("RELIANCE"))
    
    assert 100 in sbin_prices,     "SBIN prices missing"
    assert 500 in reliance_prices, "RELIANCE prices missing"
    assert 100 not in reliance_prices, "SBIN data bled into RELIANCE"
    assert 500 not in sbin_prices,     "RELIANCE data bled into SBIN"

def test_strategy_engine_vwap_none_guard():
    """BUG FIX: vwap=0.0 must be stored, not treated as falsy."""
    engine = StrategyEngine()
    engine.update_price("SBIN", 100.0, vwap=50.0)
    engine.update_price("SBIN", 100.0, vwap=0.0)  # reset at session start
    assert engine._get_vwap("SBIN") == 0.0, "vwap=0.0 was dropped (falsy bug)"

@pytest.mark.asyncio
async def test_orchestrator_survives_malformed_tick(monkeypatch):
    """BUG FIX: Malformed tick must not kill the consume loop."""
    # Create a minimal orchestrator with mocks
    mock_tick_bus = AsyncMock()
    mock_strategy = MagicMock()
    mock_market_watch = MagicMock()
    mock_event_bus = MagicMock()
    mock_event_bus.publish = AsyncMock()
    
    # Mock good tick
    good_tick = {"event_type": "tick", "symbol": "SBIN", "ltp": 100.0, "token": "123"}
    
    # Mock tick_bus.get to return one bad tick then one good tick then raise CancelledError
    # We want to test EXCEPTION handling in tick processing
    mock_tick_bus.get.side_effect = [good_tick, good_tick, asyncio.CancelledError()]
    
    orchestrator = SystemOrchestrator(
        broadcaster=MagicMock(),
        event_bus=mock_event_bus,
        candle_store=MagicMock(),
        indicator_engine=MagicMock(),
        backtest_engine=MagicMock(),
        market_watch=mock_market_watch,
        portfolio=MagicMock(),
        risk=MagicMock(),
        strategy=mock_strategy,
        portfolio_engine=MagicMock(),
        router=MagicMock(),
        instrument_loader=MagicMock(),
        market_board=MagicMock(),
        screener_engine=MagicMock(),
        obs_metrics=MagicMock(),
        obs_event_log=MagicMock(),
        obs_timeline=MagicMock()
    )
    orchestrator.tick_bus = mock_tick_bus
    
    # Make market_watch.update_tick fail on first call
    mock_market_watch.update_tick.side_effect = [ValueError("Simulated crash"), None]
    
    # Run the consumer task
    try:
        await orchestrator.consume_tick_bus()
    except asyncio.CancelledError:
        pass
        
    # Verify that it attempted to process both ticks
    # If we reached here, the loop didn't die after the first ValueError
    assert mock_market_watch.update_tick.call_count == 2
