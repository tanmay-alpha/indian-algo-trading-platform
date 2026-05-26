import pytest
from fastapi.testclient import TestClient
import backend.api_server as api
from backend.indicators.candle_patterns import detect_patterns
from backend.candles.candle_store import CandleStore

client = TestClient(api.app)


def test_detect_doji():
    # Doji has abs(close-open) <= (high-low)*0.1
    candles = [
        {"time": 1000, "open": 100.0, "high": 105.0, "low": 95.0, "close": 100.2}
    ]
    markers = detect_patterns(candles)
    assert len(markers) == 1
    assert markers[0]["pattern"] == "Doji"
    assert markers[0]["direction"] == "neutral"


def test_detect_hammer():
    # Hammer: body <= rng*0.3, lower_shadow >= 2*body, upper_shadow <= 0.25*body
    # open 100, close 101, low 97, high 101.2
    # body = 1
    # lower_shadow = min(100,101) - 97 = 3 (which is >= 2 * body)
    # upper_shadow = 101.2 - max(100,101) = 0.2 (which is <= 0.25 * body)
    # range = 4.2. body (1) <= 1.26 (rng*0.3)
    candles = [
        {"time": 1000, "open": 100.0, "high": 101.2, "low": 97.0, "close": 101.0}
    ]
    markers = detect_patterns(candles)
    assert len(markers) == 1
    assert markers[0]["pattern"] == "Hammer"
    assert markers[0]["direction"] == "bullish"


def test_detect_shooting_star():
    # Shooting Star: body <= rng*0.3, upper_shadow >= 2*body, lower_shadow <= 0.25*body
    # open 100, close 99.0, high 103.0, low 98.8
    # body = 1
    # upper_shadow = 103.0 - 100.0 = 3 (>= 2 * body)
    # lower_shadow = 99.0 - 98.8 = 0.2 (<= 0.25 * body)
    # range = 4.2. body (1) <= 1.26 (rng*0.3)
    candles = [
        {"time": 1000, "open": 100.0, "high": 103.0, "low": 98.8, "close": 99.0}
    ]
    markers = detect_patterns(candles)
    assert len(markers) == 1
    assert markers[0]["pattern"] == "Shooting Star"
    assert markers[0]["direction"] == "bearish"


def test_detect_bullish_engulfing():
    # Previous is bearish, current is bullish, current body engulfs previous body
    candles = [
        {"time": 1000, "open": 100.0, "high": 102.0, "low": 98.0, "close": 95.0}, # prev red
        {"time": 1001, "open": 94.0, "high": 103.0, "low": 93.0, "close": 101.0}  # curr green (engulfs 95-100)
    ]
    markers = detect_patterns(candles)
    assert len(markers) == 1
    assert markers[0]["pattern"] == "Bullish Engulfing"
    assert markers[0]["direction"] == "bullish"


def test_detect_bearish_engulfing():
    # Previous is bullish, current is bearish, current body engulfs previous body
    candles = [
        {"time": 1000, "open": 95.0, "high": 102.0, "low": 94.0, "close": 100.0}, # prev green
        {"time": 1001, "open": 101.0, "high": 103.0, "low": 93.0, "close": 94.0}  # curr red (engulfs 95-100)
    ]
    markers = detect_patterns(candles)
    assert len(markers) == 1
    assert markers[0]["pattern"] == "Bearish Engulfing"
    assert markers[0]["direction"] == "bearish"


def test_patterns_empty_candles():
    assert detect_patterns([]) == []


def test_patterns_route_no_candles():
    response = client.get("/patterns/SBIN?timeframe=1m")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is False
    assert data["reason"] == "NO_CANDLES"
    assert data["markers"] == []


def test_patterns_route_unknown_symbol():
    response = client.get("/patterns/UNKNOWN_XYZ?timeframe=1m")
    assert response.status_code == 404


def test_patterns_route_with_candles():
    store = api.candle_store
    # Clear any leftover live candles
    store._candles["SBIN"]["1m"].clear()
    store._live_candle["SBIN"]["1m"] = None

    candles = [
        {"time": 1700000000, "open": 100.0, "high": 105.0, "low": 95.0, "close": 100.2}
    ]
    store.load_historical("SBIN", "1m", candles)

    response = client.get("/patterns/SBIN?timeframe=1m")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is True
    assert data["symbol"] == "SBIN"
    assert len(data["markers"]) == 1
    assert data["markers"][0]["pattern"] == "Doji"
