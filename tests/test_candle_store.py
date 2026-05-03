from datetime import datetime, timezone

from backend.candles.candle_fetcher import CandleFetcher
from backend.candles.candle_store import CandleStore


def test_bucket_start_1m():
    dt = datetime(2024, 1, 2, 9, 17, 35, tzinfo=timezone.utc)
    expected = datetime(2024, 1, 2, 9, 17, 0, tzinfo=timezone.utc)
    assert CandleStore._bucket_start(dt, "1m") == int(expected.timestamp())


def test_bucket_start_5m():
    dt = datetime(2024, 1, 2, 9, 22, 10, tzinfo=timezone.utc)
    expected = datetime(2024, 1, 2, 9, 20, 0, tzinfo=timezone.utc)
    assert CandleStore._bucket_start(dt, "5m") == int(expected.timestamp())


def test_bucket_start_1h():
    dt = datetime(2024, 1, 2, 10, 45, 0, tzinfo=timezone.utc)
    expected = datetime(2024, 1, 2, 10, 0, 0, tzinfo=timezone.utc)
    assert CandleStore._bucket_start(dt, "1h") == int(expected.timestamp())


def test_update_live_candle_first_tick():
    store = CandleStore()
    dt = datetime(2024, 1, 2, 9, 15, 0, tzinfo=timezone.utc)
    store._update_live_candle("SBIN", 750.0, 1000, dt)
    live = store._live_candle["SBIN"]["1m"]
    assert live["open"] == 750.0
    assert live["high"] == 750.0
    assert live["low"] == 750.0
    assert live["close"] == 750.0


def test_update_live_candle_second_tick_same_bucket():
    store = CandleStore()
    dt = datetime(2024, 1, 2, 9, 15, 0, tzinfo=timezone.utc)
    store._update_live_candle("SBIN", 750.0, 1000, dt)
    store._update_live_candle("SBIN", 755.0, 1200, dt.replace(second=35))
    live = store._live_candle["SBIN"]["1m"]
    assert live["high"] == 755.0
    assert live["low"] == 750.0
    assert live["close"] == 755.0


def test_update_live_candle_new_bucket_finalizes_old():
    store = CandleStore()
    first = datetime(2024, 1, 2, 9, 15, 0, tzinfo=timezone.utc)
    second = datetime(2024, 1, 2, 9, 16, 0, tzinfo=timezone.utc)
    store._update_live_candle("SBIN", 750.0, 1000, first)
    store._update_live_candle("SBIN", 751.0, 1100, second)
    assert len(store._candles["SBIN"]["1m"]) == 1
    assert store._live_candle["SBIN"]["1m"]["time"] == int(second.timestamp())


def test_load_historical_stores_candles():
    store = CandleStore()
    candles = [{"time": 1000, "open": 750.0, "high": 751.0, "low": 749.0, "close": 750.5, "volume": 1000}]
    store.load_historical("SBIN", "1m", candles)
    assert len(store.get_candles("SBIN", "1m")) >= 1


def test_load_historical_deduplicates():
    store = CandleStore()
    candle = {"time": 1000, "open": 750.0, "high": 751.0, "low": 749.0, "close": 750.5, "volume": 1000}
    store.load_historical("SBIN", "1m", [candle])
    store.load_historical("SBIN", "1m", [candle])
    assert len(store.get_candles("SBIN", "1m")) == 1


def test_get_candles_includes_live():
    store = CandleStore()
    dt = datetime(2024, 1, 2, 9, 15, 0, tzinfo=timezone.utc)
    store._update_live_candle("SBIN", 750.0, 1000, dt)
    candles = store.get_candles("SBIN", "1m")
    assert candles[-1]["is_live"] is True


def test_get_candles_limit():
    store = CandleStore()
    candles = [
        {"time": index, "open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0, "volume": 1}
        for index in range(10)
    ]
    store.load_historical("SBIN", "1m", candles)
    assert len(store.get_candles("SBIN", "1m", limit=5)) == 5


def test_candle_store_max_deque_respected():
    store = CandleStore()
    count = CandleStore.MAX_CANDLES["1m"] + 10
    candles = [
        {"time": index, "open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0, "volume": 1}
        for index in range(count)
    ]
    store.load_historical("SBIN", "1m", candles)
    assert len(store._candles["SBIN"]["1m"]) == CandleStore.MAX_CANDLES["1m"]


def test_parse_angel_candle_row_valid():
    row = ["2024-01-02T09:15:00+05:30", 750.0, 755.0, 748.0, 752.0, 123456]
    result = CandleFetcher._parse_angel_candle_row(row)
    expected_dt = datetime(2024, 1, 2, 3, 45, 0, tzinfo=timezone.utc)
    assert result["open"] == 750.0
    assert result["volume"] == 123456
    assert isinstance(result["time"], int)
    assert result["time"] == int(expected_dt.timestamp())


def test_parse_angel_candle_row_malformed():
    row = ["bad_datetime", "not_a_float"]
    assert CandleFetcher._parse_angel_candle_row(row) is None
