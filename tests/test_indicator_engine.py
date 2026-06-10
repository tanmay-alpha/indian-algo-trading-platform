import math

import pytest

from backend.indicators import cpp_bridge, python_fallback
from backend.indicators.engine import IndicatorEngine


def _is_nan(value: float) -> bool:
    return math.isnan(value)


def test_python_fallback_sma_basic():
    result = python_fallback.sma([1, 2, 3, 4, 5], 3)
    assert _is_nan(result[0])
    assert _is_nan(result[1])
    assert result[2:] == [2.0, 3.0, 4.0]


def test_python_fallback_ema_seed():
    result = python_fallback.ema([1, 2, 3, 4, 5], 3)
    assert _is_nan(result[0])
    assert _is_nan(result[1])
    assert result[2] == pytest.approx(2.0)


def test_python_fallback_rsi_flat_is_50():
    result = python_fallback.rsi([10.0] * 20, 14)
    assert result[-1] == pytest.approx(50.0)


def test_python_fallback_rsi_handles_nan():
    # A single NaN should not poison later RSI values.
    values = [float(i) for i in range(1, 31)]
    values[5] = math.nan
    result = python_fallback.rsi(values, 14)
    assert len(result) == 30
    # Index 20 is well past the NaN; must be a real RSI value, not NaN.
    # For a rising market with one missing sample, RSI can be exactly 100.
    assert not math.isnan(result[20])
    assert 0.0 < result[20] <= 100.0


def test_python_fallback_macd_shape():
    close = [float(i) for i in range(1, 61)]
    result = python_fallback.macd(close)
    assert len(result["macd"]) == len(close)
    assert len(result["signal"]) == len(close)
    assert len(result["histogram"]) == len(close)
    assert _is_nan(result["macd"][0])
    assert not _is_nan(result["macd"][-1])


def test_python_fallback_atr_shape():
    candles = [
        {"open": 10.0, "high": 12.0, "low": 9.0, "close": 11.0, "volume": 100.0},
        {"open": 11.0, "high": 13.0, "low": 10.0, "close": 12.0, "volume": 120.0},
        {"open": 12.0, "high": 14.0, "low": 11.0, "close": 13.0, "volume": 130.0},
    ]
    result = python_fallback.atr(candles, 3)
    assert len(result) == 3
    assert _is_nan(result[0])
    assert _is_nan(result[1])
    assert not _is_nan(result[2])


def test_python_fallback_vwap_basic():
    candles = [
        {"open": 9.0, "high": 10.0, "low": 8.0, "close": 9.0, "volume": 100.0},
        {"open": 11.0, "high": 12.0, "low": 10.0, "close": 11.0, "volume": 100.0},
    ]
    result = python_fallback.vwap(candles)
    assert result == pytest.approx([9.0, 10.0])


def test_python_fallback_vwap_day_reset():
    # Day 1: 1716714000 (May 26 2024 09:15:00 UTC)
    # Day 2: 1716800400 (May 27 2024 09:15:00 UTC)
    candles = [
        {"open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 10.0, "time": 1716714000},
        {"open": 200.0, "high": 200.0, "low": 200.0, "close": 200.0, "volume": 10.0, "time": 1716714060},
        # Day 2 starts here - should reset.
        {"open": 150.0, "high": 150.0, "low": 150.0, "close": 150.0, "volume": 10.0, "time": 1716800400},
    ]
    result = python_fallback.vwap(candles)
    # Without reset, VWAP would be: (100*10 + 200*10 + 150*10)/30 = 150.0
    # With reset, Day 2 VWAP should be: (150*10)/10 = 150.0. Wait, that's the same! Let's choose different values to distinguish.
    # Day 1: 100 * 10 + 100 * 10 = 2000. Sum volume = 20. VWAP = 100.0
    # Day 2: 300 * 10 = 3000.
    # If NO reset: (2000 + 3000)/30 = 166.67
    # If reset: 3000 / 10 = 300.0
    candles = [
        {"open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 10.0, "time": 1716714000},
        {"open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 10.0, "time": 1716714060},
        {"open": 300.0, "high": 300.0, "low": 300.0, "close": 300.0, "volume": 10.0, "time": 1716800400},
    ]
    result = python_fallback.vwap(candles)
    assert result[2] == pytest.approx(300.0)

    # Test ISO strings
    candles_iso = [
        {"open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 10.0, "time": "2026-05-26T09:15:00Z"},
        {"open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 10.0, "time": "2026-05-26T09:16:00Z"},
        {"open": 300.0, "high": 300.0, "low": 300.0, "close": 300.0, "volume": 10.0, "time": "2026-05-27T09:15:00Z"},
    ]
    result_iso = python_fallback.vwap(candles_iso)
    assert result_iso[2] == pytest.approx(300.0)


def test_python_fallback_bollinger_shape():
    result = python_fallback.bollinger_bands([1, 2, 3, 4, 5], 3)
    assert len(result["middle"]) == 5
    assert result["middle"][2] == pytest.approx(2.0)
    assert result["upper"][2] > result["middle"][2]
    assert result["lower"][2] < result["middle"][2]


def test_indicator_engine_status_has_fallback():
    status = IndicatorEngine(prefer_cpp=False).status()
    assert "selected_engine" in status
    assert "cpp_available" in status
    assert status["selected_engine"] == "python"
    assert status["fallback_available"] is True
    assert isinstance(status["indicators"], list)
    assert "sma" in status["indicators"]


def test_python_fallback_empty_inputs_are_safe():
    assert python_fallback.sma([], 3) == []
    assert python_fallback.ema([], 3) == []
    assert python_fallback.rsi([], 14) == []
    assert python_fallback.atr([], 14) == []
    assert python_fallback.vwap([]) == []
    assert python_fallback.macd([]) == {"macd": [], "signal": [], "histogram": []}
    assert python_fallback.bollinger_bands([], 20) == {"middle": [], "upper": [], "lower": []}


def test_python_fallback_invalid_periods_raise():
    with pytest.raises(ValueError):
        python_fallback.sma([1.0, 2.0], 0)
    with pytest.raises(ValueError):
        python_fallback.ema([1.0, 2.0], -1)
    with pytest.raises(ValueError):
        python_fallback.rsi([1.0, 2.0], 0)
    with pytest.raises(ValueError):
        python_fallback.atr([{"open": 1, "high": 2, "low": 1, "close": 2, "volume": 10}], 0)
    with pytest.raises(ValueError):
        python_fallback.macd([1.0, 2.0], 12, 12, 9)
    with pytest.raises(ValueError):
        python_fallback.bollinger_bands([1.0, 2.0], 2, 0.0)


def test_indicator_engine_uses_python_when_cpp_missing(monkeypatch):
    monkeypatch.setattr(cpp_bridge, "CPP_AVAILABLE", False)
    engine = IndicatorEngine(prefer_cpp=True)
    assert engine.selected_engine == "python"


def test_indicator_engine_calculate_multiple():
    close = [float(i) for i in range(1, 61)]
    candles = [
        {"open": value, "high": value + 1, "low": value - 1, "close": value, "volume": 100.0}
        for value in close
    ]
    result = IndicatorEngine(prefer_cpp=False).calculate(
        close=close,
        candles=candles,
        indicators=["ema", "rsi", "macd", "vwap"],
        params={"ema_period": 3, "rsi_period": 14},
    )
    assert result["engine"] == "python"
    assert {"ema", "rsi", "macd", "vwap"}.issubset(result["results"])


def test_backend_import_safe_without_cpp():
    import backend.api_server  # noqa: F401


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_sma_matches_fallback():
    values = [1, 2, 3, 4, 5]
    cpp_result = cpp_bridge.sma(values, 3)
    fallback_result = python_fallback.sma(values, 3)
    for cpp_value, fallback_value in zip(cpp_result, fallback_result):
        if math.isnan(fallback_value):
            assert math.isnan(cpp_value)
        else:
            assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_ema_matches_fallback():
    cpp_result = cpp_bridge.ema([1, 2, 3, 4, 5, 6, 7, 8], 3)
    fallback_result = python_fallback.ema([1, 2, 3, 4, 5, 6, 7, 8], 3)
    for cpp_value, fallback_value in zip(cpp_result, fallback_result):
        if math.isnan(fallback_value):
            assert math.isnan(cpp_value)
        else:
            assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_rsi_matches_fallback():
    close = [float(i) for i in range(1, 31)]
    cpp_result = cpp_bridge.rsi(close, 14)
    fallback_result = python_fallback.rsi(close, 14)
    for cpp_value, fallback_value in zip(cpp_result, fallback_result):
        if math.isnan(fallback_value):
            assert math.isnan(cpp_value)
        else:
            assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_macd_matches_fallback():
    close = [float(i) for i in range(1, 61)]
    cpp_result = cpp_bridge.macd(close)
    fallback_result = python_fallback.macd(close)
    for key in ("macd", "signal", "histogram"):
        for cpp_value, fallback_value in zip(cpp_result[key], fallback_result[key]):
            if math.isnan(fallback_value):
                assert math.isnan(cpp_value)
            else:
                assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_atr_matches_fallback():
    candles = [
        {"open": float(i), "high": float(i + 1), "low": float(i - 1), "close": float(i), "volume": 100.0}
        for i in range(1, 31)
    ]
    cpp_result = cpp_bridge.atr(candles, 14)
    fallback_result = python_fallback.atr(candles, 14)
    for cpp_value, fallback_value in zip(cpp_result, fallback_result):
        if math.isnan(fallback_value):
            assert math.isnan(cpp_value)
        else:
            assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_vwap_matches_fallback():
    candles = [
        {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "volume": 10.0, "time": 1716714000},
        {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "volume": 10.0, "time": 1716714060},
        {"open": 300.0, "high": 301.0, "low": 299.0, "close": 300.5, "volume": 10.0, "time": 1716800400},
    ]
    cpp_result = cpp_bridge.vwap(candles)
    fallback_result = python_fallback.vwap(candles)
    for cpp_value, fallback_value in zip(cpp_result, fallback_result):
        if math.isnan(fallback_value):
            assert math.isnan(cpp_value)
        else:
            assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_bollinger_matches_fallback():
    close = [float(i) for i in range(1, 31)]
    cpp_result = cpp_bridge.bollinger_bands(close, 20, 2.0)
    fallback_result = python_fallback.bollinger_bands(close, 20, 2.0)
    for key in ("middle", "upper", "lower"):
        for cpp_value, fallback_value in zip(cpp_result[key], fallback_result[key]):
            if math.isnan(fallback_value):
                assert math.isnan(cpp_value)
            else:
                assert cpp_value == pytest.approx(fallback_value)


@pytest.mark.skipif(not cpp_bridge.cpp_available(), reason="C++ indicator module not compiled")
def test_cpp_bridge_oversize_input_rejected():
    # 100001 values exceed the 100,000 internal C++ ceiling.
    big = [1.0] * 100001
    with pytest.raises(RuntimeError):
        cpp_bridge.sma(big, 5)
