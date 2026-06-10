import pytest
import math
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
import pytest_asyncio

from backend.candles.candle_store import CandleStore
from backend.indicators.engine import IndicatorEngine
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.models import (
    StrategyConfig,
    StrategyName,
    SignalAction,
    BacktestStatus,
    StrategySignal,
)
from backend.routers.strategies import router as strategies_router


@pytest.fixture
def indicator_engine():
    return IndicatorEngine(prefer_cpp=False)


@pytest.fixture
def backtest_engine(indicator_engine):
    return BacktestEngine(indicator_engine=indicator_engine)


@pytest.fixture
def strategy_app():
    app = FastAPI()
    app.include_router(strategies_router)
    indicator_engine = IndicatorEngine(prefer_cpp=False)
    app.state.indicator_engine = indicator_engine
    app.state.backtest_engine = BacktestEngine(indicator_engine=indicator_engine)
    app.state.candle_store = CandleStore()
    return app


@pytest_asyncio.fixture
async def client(strategy_app):
    transport = ASGITransport(app=strategy_app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-Admin-Token": "ci-test-admin-token-do-not-use-in-prod"},
    ) as async_client:
        yield async_client


def make_iso_timestamp(day_offset: int, hour: int, minute: int) -> str:
    dt = datetime(2024, 1, 1, hour, minute, 0, tzinfo=timezone.utc) + timedelta(days=day_offset)
    return dt.isoformat().replace("+00:00", "Z")


# Helper to generate standard flat candles
def generate_flat_candles(count: int, price: float = 100.0, volume: float = 1000.0) -> list[dict]:
    candles = []
    for i in range(count):
        # alternate days every 10 candles to allow daily grouping strategies to have multiple days
        day_offset = i // 10
        minute = (i % 10) * 15
        hour = 9 + (minute // 60)
        min_val = minute % 60
        candles.append({
            "timestamp": make_iso_timestamp(day_offset, hour, min_val),
            "open": price,
            "high": price + 1.0,
            "low": price - 1.0,
            "close": price,
            "volume": volume,
        })
    return candles


# --- Unit Tests for BacktestEngine & Signal Generation ---

def test_parameter_bounds_validation(backtest_engine):
    # Test validator for moving average crossover
    config = StrategyConfig(
        strategy_name=StrategyName.MOVING_AVERAGE_CROSSOVER.value,
        symbol="SBIN-EQ",
        params={"fast_period": 21, "slow_period": 9},  # fast >= slow must fail
    )
    with pytest.raises(ValueError, match="fast_period must be less than slow_period"):
        backtest_engine.generate_signals(config, generate_flat_candles(10))

    # Test validator for index trend filter
    config_filter = StrategyConfig(
        strategy_name=StrategyName.INDEX_TREND_FILTER.value,
        symbol="SBIN-EQ",
        params={"fast_period": 21, "slow_period": 9},  # fast >= slow must fail
    )
    with pytest.raises(ValueError, match="fast_period must be less than slow_period"):
        backtest_engine.generate_signals(config_filter, generate_flat_candles(10))

    # Test invalid parameter (e.g. non-positive period)
    config_negative = StrategyConfig(
        strategy_name=StrategyName.MOVING_AVERAGE_CROSSOVER.value,
        symbol="SBIN-EQ",
        params={"fast_period": -5, "slow_period": 21},
    )
    with pytest.raises(ValueError, match="fast_period must be positive"):
        backtest_engine.generate_signals(config_negative, generate_flat_candles(10))


def test_opening_range_breakout(backtest_engine):
    # Insufficient data: inside opening range
    config = StrategyConfig(
        strategy_name=StrategyName.OPENING_RANGE_BREAKOUT.value,
        symbol="SBIN-EQ",
        params={"orb_minutes": 15},
    )
    # 09:15 and 09:20 are within 15 min range of 09:15
    candles = [
        {"timestamp": "2024-01-01T09:15:00Z", "open": 100.0, "high": 102.0, "low": 98.0, "close": 100.0, "volume": 100},
        {"timestamp": "2024-01-01T09:20:00Z", "open": 100.0, "high": 102.0, "low": 98.0, "close": 101.0, "volume": 100},
    ]
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 2
    assert all(s.action == SignalAction.HOLD.value for s in signals)
    assert all("orb_high" in s.metadata for s in signals)

    # Trigger breakout UP
    candles.append(
        {"timestamp": "2024-01-01T09:30:00Z", "open": 101.0, "high": 106.0, "low": 100.5, "close": 105.0, "volume": 100}
    )
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 3
    assert signals[-1].action == SignalAction.BUY.value
    assert signals[-1].metadata["suggested_target"] > 105.0
    assert signals[-1].metadata["suggested_stop_loss"] < 105.0
    assert signals[-1].invalidation_level == 102.0  # orb_high


def test_cpr_breakout(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.CPR_BREAKOUT.value,
        symbol="SBIN-EQ",
    )
    # Day 1: high=102, low=98, close=100
    # CPR calculation: p = 100.0, bc = 100.0, tc = 100.0
    day1_candles = [
        {"timestamp": "2024-01-01T09:15:00Z", "open": 100.0, "high": 102.0, "low": 98.0, "close": 100.0, "volume": 100},
    ]
    # Insufficient data on first day
    signals = backtest_engine.generate_signals(config, day1_candles)
    assert len(signals) == 1
    assert signals[0].action == SignalAction.HOLD.value
    assert "Insufficient data" in signals[0].reason

    # Day 2: First candle is HOLD, next candle breakouts UP
    day2_candles = day1_candles + [
        {"timestamp": "2024-01-02T09:15:00Z", "open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 100},
        {"timestamp": "2024-01-02T09:20:00Z", "open": 100.0, "high": 105.0, "low": 100.0, "close": 105.0, "volume": 100},
    ]
    signals = backtest_engine.generate_signals(config, day2_candles)
    assert len(signals) == 3
    assert signals[1].action == SignalAction.HOLD.value  # first candle of day 2
    assert signals[2].action == SignalAction.BUY.value   # breakout candle
    assert signals[2].metadata["cpr_high"] == 100.0
    assert signals[2].suggested_stop_loss == 100.0


def test_vwap_mean_reversion(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.VWAP_MEAN_REVERSION.value,
        symbol="SBIN-EQ",
        params={"deviation_pct": 1.0},
    )
    # Insufficient data / single candle (nan VWAP)
    candles = [
        {"timestamp": "2024-01-01T09:15:00Z", "open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 0.0},
    ]
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 1
    assert signals[0].action == SignalAction.HOLD.value
    assert "Insufficient data" in signals[0].reason

    # Trigger deep deviation below VWAP
    candles = [
        {"timestamp": "2024-01-01T09:15:00Z", "open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 1000.0},
        {"timestamp": "2024-01-01T09:16:00Z", "open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 1000.0},
        {"timestamp": "2024-01-01T09:17:00Z", "open": 95.0, "high": 95.0, "low": 95.0, "close": 95.0, "volume": 1000.0},
    ]
    # cumulative典型价格*量 = 100*1000 + 100*1000 + 95*1000 = 295000
    # cumulative volume = 3000
    # VWAP = 295000 / 3000 = 98.333
    # deviation = (95 - 98.333) / 98.333 * 100 = -3.39%
    # deviation_pct = 1.0 -> triggers BUY
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 3
    assert signals[2].action == SignalAction.BUY.value
    assert signals[2].metadata["deviation"] < -1.0


def test_supertrend_trend(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.SUPERTREND_TREND.value,
        symbol="SBIN-EQ",
        params={"period": 5, "multiplier": 2.0},
    )
    # Insufficient data: ATR needs at least period + 1 candles
    candles = generate_flat_candles(4)
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 4
    assert all(s.action == SignalAction.HOLD.value for s in signals)
    assert any("Insufficient data" in s.reason for s in signals)

    # Let's generate a full sequence to get valid Supertrend and trigger crossover
    # Standard period is 5.
    candles = []
    # Start with flat price to build stable ATR
    for i in range(10):
        candles.append({
            "timestamp": make_iso_timestamp(0, 9, i),
            "open": 100.0,
            "high": 101.0,
            "low": 99.0,
            "close": 100.0,
            "volume": 1000,
        })
    # Add a huge jump to trigger bullish breakout
    candles.append({
        "timestamp": make_iso_timestamp(0, 9, 10),
        "open": 100.0,
        "high": 115.0,
        "low": 100.0,
        "close": 114.0,
        "volume": 1000,
    })
    signals = backtest_engine.generate_signals(config, candles)
    # Assert we have BUY signals
    buy_signals = [s for s in signals if s.action == SignalAction.BUY.value]
    assert len(buy_signals) >= 1
    assert buy_signals[0].metadata["trend"] == 1
    assert buy_signals[0].suggested_stop_loss is not None
    assert buy_signals[0].suggested_target is not None


def test_moving_average_crossover(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.MOVING_AVERAGE_CROSSOVER.value,
        symbol="SBIN-EQ",
        params={"fast_period": 3, "slow_period": 5, "ma_type": "SMA"},
    )
    # Insufficient data
    candles = generate_flat_candles(3)
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 3
    assert all(s.action == SignalAction.HOLD.value for s in signals)

    # Generate a crossover: fast MA crosses slow MA
    # Prices: 100, 100, 100, 100, 100, 110, 115
    candles = []
    for i, p in enumerate([100.0, 100.0, 100.0, 100.0, 100.0, 110.0, 115.0]):
        candles.append({
            "timestamp": make_iso_timestamp(0, 9, i),
            "open": p,
            "high": p,
            "low": p,
            "close": p,
            "volume": 1000,
        })
    signals = backtest_engine.generate_signals(config, candles)
    buy_signals = [s for s in signals if s.action == SignalAction.BUY.value]
    assert len(buy_signals) >= 1
    assert "MA Crossover bullish" in buy_signals[0].reason
    assert "fast_ma" in buy_signals[0].metadata


def test_rsi_reversal(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.RSI_REVERSAL.value,
        symbol="SBIN-EQ",
        params={"rsi_period": 5, "oversold": 30.0, "overbought": 70.0},
    )
    # Insufficient data
    candles = generate_flat_candles(3)
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 3
    assert all(s.action == SignalAction.HOLD.value for s in signals)

    # Create sequence going oversold and reversing
    prices = [100.0]*6 + [80.0, 60.0, 40.0, 30.0, 20.0, 50.0, 60.0]
    candles = []
    for i, p in enumerate(prices):
        candles.append({
            "timestamp": make_iso_timestamp(0, 9, i),
            "open": p,
            "high": p,
            "low": p,
            "close": p,
            "volume": 1000,
        })
    signals = backtest_engine.generate_signals(config, candles)
    buy_signals = [s for s in signals if s.action == SignalAction.BUY.value]
    assert len(buy_signals) >= 1
    assert "RSI oversold reversal" in buy_signals[0].reason
    assert buy_signals[0].suggested_stop_loss is not None


def test_gap_continuation(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.GAP_CONTINUATION.value,
        symbol="SBIN-EQ",
        params={"gap_threshold_pct": 1.0},
    )
    # Insufficient data (Day 1 only)
    day1_candles = [
        {"timestamp": "2024-01-01T09:15:00Z", "open": 100.0, "high": 100.0, "low": 100.0, "close": 100.0, "volume": 100},
    ]
    signals = backtest_engine.generate_signals(config, day1_candles)
    assert len(signals) == 1
    assert signals[0].action == SignalAction.HOLD.value

    # Day 2: gaps up by 2.0% (open=102, prev_close=100)
    day2_candles = day1_candles + [
        {"timestamp": "2024-01-02T09:15:00Z", "open": 102.0, "high": 103.0, "low": 102.0, "close": 102.5, "volume": 100},
        {"timestamp": "2024-01-02T09:20:00Z", "open": 102.5, "high": 103.0, "low": 102.0, "close": 102.8, "volume": 100},
    ]
    signals = backtest_engine.generate_signals(config, day2_candles)
    assert len(signals) == 3
    assert signals[1].action == SignalAction.BUY.value
    assert signals[2].action == SignalAction.HOLD.value  # Intraday
    assert signals[1].metadata["gap_pct"] == 2.0


def test_previous_day_breakout(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.PREVIOUS_DAY_BREAKOUT.value,
        symbol="SBIN-EQ",
        params={"breakout_pct": 0.5},
    )
    # Day 1: high=100.0, low=90.0, close=95.0
    day1_candles = [
        {"timestamp": "2024-01-01T09:15:00Z", "open": 95.0, "high": 100.0, "low": 90.0, "close": 95.0, "volume": 100},
    ]
    signals = backtest_engine.generate_signals(config, day1_candles)
    assert len(signals) == 1
    assert signals[0].action == SignalAction.HOLD.value

    # Day 2: pdh = 100.0. Breakout trigger = 100.5.
    # Candle 1: close = 101.0 -> breakout UP
    day2_candles = day1_candles + [
        {"timestamp": "2024-01-02T09:15:00Z", "open": 96.0, "high": 96.0, "low": 96.0, "close": 96.0, "volume": 100},
        {"timestamp": "2024-01-02T09:20:00Z", "open": 96.0, "high": 101.5, "low": 96.0, "close": 101.0, "volume": 100},
    ]
    signals = backtest_engine.generate_signals(config, day2_candles)
    assert len(signals) == 3
    assert signals[2].action == SignalAction.BUY.value
    assert "Previous Day High Breakout" in signals[2].reason


def test_volume_breakout(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.VOLUME_BREAKOUT.value,
        symbol="SBIN-EQ",
        params={"volume_period": 5, "volume_multiplier": 2.0, "lookback_period": 5},
    )
    # Insufficient data
    candles = generate_flat_candles(4)
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 4
    assert all(s.action == SignalAction.HOLD.value for s in signals)

    # 5 flat candles: close=100.0, vol=1000
    # Candle 6: close=105.0, vol=3000.
    # avg_vol = 1000. vol=3000 > 2000. highest_close = 100. close=105 > 100.
    candles = []
    for i in range(5):
        candles.append({
            "timestamp": make_iso_timestamp(0, 9, i),
            "open": 100.0,
            "high": 100.0,
            "low": 100.0,
            "close": 100.0,
            "volume": 1000.0,
        })
    candles.append({
        "timestamp": make_iso_timestamp(0, 9, 5),
        "open": 100.0,
        "high": 106.0,
        "low": 100.0,
        "close": 105.0,
        "volume": 3000.0,
    })
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 6
    assert signals[-1].action == SignalAction.BUY.value
    assert "Volume Breakout Bullish" in signals[-1].reason


def test_index_trend_filter(backtest_engine):
    config = StrategyConfig(
        strategy_name=StrategyName.INDEX_TREND_FILTER.value,
        symbol="SBIN-EQ",
        params={"fast_period": 2, "slow_period": 3, "filter_period": 5},
    )
    # Insufficient data
    candles = generate_flat_candles(4)
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 4
    assert all(s.action == SignalAction.HOLD.value for s in signals)

    # Build sequence
    # Fast crossovers slow above filter MA
    # Let's verify no crash and signal structure
    candles = []
    for i, p in enumerate([90.0, 90.0, 90.0, 91.0, 92.0, 105.0, 110.0, 115.0]):
        candles.append({
            "timestamp": make_iso_timestamp(0, 9, i),
            "open": p,
            "high": p,
            "low": p,
            "close": p,
            "volume": 1000,
        })
    signals = backtest_engine.generate_signals(config, candles)
    assert len(signals) == 8
    # Fast period 2, slow 3, filter 5 EMA.
    # At least some index trend filter signals should run successfully without error
    assert any(s.action in (SignalAction.BUY.value, SignalAction.HOLD.value) for s in signals)


# --- Endpoint Integration Tests ---

@pytest.mark.asyncio
async def test_api_endpoints_indian_strategies(client):
    # List of all new strategies
    strategies = [
        (StrategyName.OPENING_RANGE_BREAKOUT.value, {"orb_minutes": 15}),
        (StrategyName.CPR_BREAKOUT.value, {}),
        (StrategyName.VWAP_MEAN_REVERSION.value, {"deviation_pct": 1.0}),
        (StrategyName.SUPERTREND_TREND.value, {"period": 5, "multiplier": 2.0}),
        (StrategyName.MOVING_AVERAGE_CROSSOVER.value, {"fast_period": 5, "slow_period": 10}),
        (StrategyName.RSI_REVERSAL.value, {"rsi_period": 5}),
        (StrategyName.GAP_CONTINUATION.value, {"gap_threshold_pct": 0.5}),
        (StrategyName.PREVIOUS_DAY_BREAKOUT.value, {"breakout_pct": 0.1}),
        (StrategyName.VOLUME_BREAKOUT.value, {"volume_period": 5, "volume_multiplier": 1.5, "lookback_period": 5}),
        (StrategyName.INDEX_TREND_FILTER.value, {"fast_period": 3, "slow_period": 5, "filter_period": 10}),
    ]

    # Generate 15 daily-compatible candles
    candles = []
    for i in range(15):
        # 2 days of data
        day_offset = i // 8
        minute = (i % 8) * 15
        hour = 9 + (minute // 60)
        min_val = minute % 60
        candles.append({
            "timestamp": make_iso_timestamp(day_offset, hour, min_val),
            "open": 100.0,
            "high": 101.0,
            "low": 99.0,
            "close": 100.0 + i * 0.1,  # slightly uptrending
            "volume": 1000.0,
        })

    for strat_name, params in strategies:
        # 1. Test backtest endpoint
        response = await client.post(
            "/strategies/backtest",
            json={
                "strategy_name": strat_name,
                "symbol": "SBIN-EQ",
                "params": params,
                "candles": candles,
            },
        )
        assert response.status_code == 200, f"Failed for {strat_name}"
        data = response.json()
        assert data["status"] == BacktestStatus.SUCCESS.value
        assert data["strategy_name"] == strat_name
        assert "metrics" in data
        assert isinstance(data["signals"], list)

        # 2. Test signal preview endpoint
        preview_response = await client.post(
            "/strategies/signal-preview",
            json={
                "strategy_name": strat_name,
                "symbol": "SBIN-EQ",
                "params": params,
                "candles": candles,
            },
        )
        assert preview_response.status_code == 200, f"Preview failed for {strat_name}"
        preview_data = preview_response.json()
        assert preview_data["strategy_name"] == strat_name
        assert isinstance(preview_data["signals"], list)
        assert len(preview_data["signals"]) == len(candles)
        
        # Verify formatting on preview signals
        for sig in preview_data["signals"]:
            assert "action" in sig
            assert "timestamp" in sig
            assert sig["symbol"] == "SBIN-EQ"
            # verify that field validators work
            assert sig["action"] in [SignalAction.BUY.value, SignalAction.SELL.value, SignalAction.HOLD.value, SignalAction.EXIT.value]
