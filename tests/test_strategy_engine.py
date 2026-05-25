import pytest
from backend.engine.strategy_engine import StrategyEngine

def test_strategy_engine_warmup():
    engine = StrategyEngine(window_size=10)
    # Warmup limit is min(5, window_size) = 5
    for i in range(4):
        signal = engine.update_price(100.0 + i, 100.0)
        assert signal == "NEUTRAL"
    
    # 5th price should trigger evaluation
    signal = engine.update_price(104.0, 100.0)
    # deviation = (104.0 - 100.0) / 100.0 = 0.04 > 0.0015 -> should trigger SELL
    assert signal == "SELL"

def test_strategy_engine_warmup_small_window():
    # If window size is small, e.g. 3, warmup limit is min(5, 3) = 3
    engine = StrategyEngine(window_size=3)
    for i in range(2):
        signal = engine.update_price(100.0 + i, 100.0)
        assert signal == "NEUTRAL"
    
    signal = engine.update_price(103.0, 100.0)
    # deviation = (103.0 - 100.0) / 100.0 = 0.03 > 0.0015 -> should trigger SELL
    assert signal == "SELL"

def test_strategy_engine_vwap_zero():
    engine = StrategyEngine(window_size=10)
    # Feed 5 ticks with VWAP = 0.0
    for i in range(5):
        signal = engine.update_price(100.0 + i, 0.0)
    assert signal == "NEUTRAL"

def test_strategy_engine_vwap_none_fallback():
    engine = StrategyEngine(window_size=10)
    # Feed initial VWAP
    engine.update_price(100.0, 100.0)
    # Subsequent ticks with VWAP = None should fall back to last known VWAP
    for i in range(1, 4):
        signal = engine.update_price(100.0 + i, None)
        assert signal == "NEUTRAL"
    
    # 5th tick
    signal = engine.update_price(105.0, None)
    assert signal == "SELL"

def test_strategy_engine_deviation_signals():
    engine = StrategyEngine(window_size=5)
    
    # Fill up warmup
    for i in range(4):
        engine.update_price(100.0, 100.0)
        
    # Test Bearish deviation (Price far above VWAP -> SELL)
    assert engine.update_price(102.0, 100.0) == "SELL"
    
    # Check that we neutralize near VWAP
    assert engine.update_price(100.01, 100.0) == "NEUTRAL"
    
    # Test Bullish deviation (Price far below VWAP -> BUY)
    assert engine.update_price(97.0, 100.0) == "BUY"
