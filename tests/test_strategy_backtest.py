from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from backend.candles.candle_store import CandleStore
from backend.indicators.engine import IndicatorEngine
from backend.routers.strategies import router as strategies_router
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.models import BacktestStatus, StrategyConfig, StrategyName
from backend.strategy.templates import get_strategy_templates


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
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


def trend_candles(count: int = 80) -> list[dict]:
    candles = []
    for index in range(count):
        if index < count // 3:
            close = 120.0 - index * 0.5
        else:
            close = 100.0 + (index - count // 3) * 0.9
        candles.append({
            "time": 1700000000 + index * 60,
            "open": close - 0.25,
            "high": close + 0.75,
            "low": close - 0.75,
            "close": close,
            "volume": 1000 + index,
        })
    return candles


def oscillating_candles(count: int = 90) -> list[dict]:
    candles = []
    for index in range(count):
        base = 100.0 + (index % 20 - 10) * 0.8
        close = base + index * 0.03
        candles.append({
            "timestamp": f"2024-01-01T09:{index:02d}:00Z",
            "open": close - 0.3,
            "high": close + 0.9,
            "low": close - 0.9,
            "close": close,
            "volume": 1500 + index * 2,
        })
    return candles


@pytest.mark.asyncio
async def test_strategy_templates_available(client):
    response = await client.get("/strategies/templates")
    data = response.json()
    assert response.status_code == 200
    assert len(data["templates"]) == len(get_strategy_templates())
    assert data["templates"][0]["live_execution_enabled"] is False


@pytest.mark.asyncio
async def test_backtest_status_route(client):
    response = await client.get("/strategies/status")
    data = response.json()
    assert response.status_code == 200
    assert data["available"] is True
    assert data["live_execution_enabled"] is False
    assert data["backtesting_enabled"] is True


@pytest.mark.asyncio
async def test_ema_crossover_backtest_with_posted_candles(client):
    response = await client.post(
        "/strategies/backtest",
        json={
            "strategy_name": StrategyName.EMA_CROSSOVER.value,
            "symbol": "SBIN-EQ",
            "timeframe": "1m",
            "params": {"fast_period": 5, "slow_period": 12},
            "initial_capital": 100000,
            "quantity": 10,
            "candles": trend_candles(),
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["status"] == BacktestStatus.SUCCESS.value
    assert "metrics" in data
    assert data["metrics"]["total_trades"] >= 0
    assert data["strategy_name"] == StrategyName.EMA_CROSSOVER.value


@pytest.mark.asyncio
async def test_rsi_mean_reversion_backtest_no_crash(client):
    response = await client.post(
        "/strategies/backtest",
        json={
            "strategy_name": StrategyName.RSI_MEAN_REVERSION.value,
            "symbol": "SBIN-EQ",
            "params": {"rsi_period": 6, "oversold": 35, "overbought": 65},
            "candles": oscillating_candles(),
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == BacktestStatus.SUCCESS.value


@pytest.mark.asyncio
async def test_macd_trend_backtest_no_crash(client):
    response = await client.post(
        "/strategies/backtest",
        json={
            "strategy_name": StrategyName.MACD_TREND.value,
            "symbol": "SBIN-EQ",
            "params": {"fast_period": 6, "slow_period": 13, "signal_period": 5},
            "candles": trend_candles(),
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == BacktestStatus.SUCCESS.value


@pytest.mark.asyncio
async def test_vwap_pullback_backtest_no_crash(client):
    response = await client.post(
        "/strategies/backtest",
        json={
            "strategy_name": StrategyName.VWAP_PULLBACK.value,
            "symbol": "SBIN-EQ",
            "params": {"threshold_pct": 0.0},
            "candles": oscillating_candles(),
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == BacktestStatus.SUCCESS.value


@pytest.mark.asyncio
async def test_bollinger_breakout_backtest_no_crash(client):
    response = await client.post(
        "/strategies/backtest",
        json={
            "strategy_name": StrategyName.BOLLINGER_BREAKOUT.value,
            "symbol": "SBIN-EQ",
            "params": {"period": 10, "stddev": 1.5},
            "candles": trend_candles(),
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == BacktestStatus.SUCCESS.value


@pytest.mark.asyncio
async def test_backtest_no_candles_returns_no_candles(client):
    response = await client.post(
        "/strategies/backtest",
        json={
            "strategy_name": StrategyName.EMA_CROSSOVER.value,
            "symbol": "SBIN-EQ",
            "candles": [],
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["status"] == BacktestStatus.NO_CANDLES.value
    assert data["reason"] == "NO_CANDLES"


@pytest.mark.asyncio
async def test_backtest_rejects_unknown_strategy(client):
    response = await client.post(
        "/strategies/backtest",
        json={"strategy_name": "UNKNOWN", "symbol": "SBIN-EQ", "candles": trend_candles()},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_signal_preview_returns_signals_shape(client):
    response = await client.post(
        "/strategies/signal-preview",
        json={
            "strategy_name": StrategyName.EMA_CROSSOVER.value,
            "symbol": "SBIN-EQ",
            "params": {"fast_period": 5, "slow_period": 12},
            "candles": trend_candles(),
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["strategy_name"] == StrategyName.EMA_CROSSOVER.value
    assert isinstance(data["signals"], list)
    assert "count" in data


def test_backtest_metrics_no_division_by_zero():
    engine = BacktestEngine(indicator_engine=IndicatorEngine(prefer_cpp=False))
    result = engine.run_backtest(
        StrategyConfig(
            strategy_name=StrategyName.EMA_CROSSOVER.value,
            symbol="SBIN-EQ",
            params={"fast_period": 50, "slow_period": 60},
        ),
        trend_candles(count=10),
    )
    assert result.status == BacktestStatus.SUCCESS.value
    assert result.metrics.total_trades == 0
    assert result.metrics.profit_factor is None


def test_api_server_import_safe():
    import backend.api_server  # noqa: F401

