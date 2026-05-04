from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from backend.candles.candle_store import CandleStore
from backend.indicators.engine import IndicatorEngine
from backend.routers.indicators import router


@pytest.fixture
def indicator_app():
    app = FastAPI()
    app.include_router(router)
    app.state.candle_store = CandleStore()
    app.state.indicator_engine = IndicatorEngine(prefer_cpp=False)
    return app


@pytest_asyncio.fixture
async def client(indicator_app):
    transport = ASGITransport(app=indicator_app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_indicators_status(client):
    response = await client.get("/indicators/status")
    data = response.json()
    assert response.status_code == 200
    assert data["available"] is True
    assert "selected_engine" in data
    assert "cpp_available" in data
    assert data["fallback_available"] is True
    assert "ema" in data["indicators"]
    serialized = str(data).lower()
    assert "password" not in serialized
    assert "api_key" not in serialized
    assert "jwt" not in serialized
    assert "refresh" not in serialized
    assert "token" not in serialized


@pytest.mark.asyncio
async def test_calculate_post_sma_ema_rsi(client):
    response = await client.post(
        "/indicators/calculate",
        json={
            "close": [float(i) for i in range(1, 21)],
            "indicators": ["sma", "ema", "rsi"],
            "params": {"sma_period": 3, "ema_period": 3, "rsi_period": 3},
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["available"] is True
    assert data["results"]["sma"][2] == 2.0
    assert data["results"]["ema"][2] == 2.0
    assert data["results"]["rsi"][-1] == 100.0


@pytest.mark.asyncio
async def test_calculate_post_rejects_unknown_indicator(client):
    response = await client.post(
        "/indicators/calculate",
        json={"close": [1, 2, 3], "indicators": ["unknown"], "params": {}},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_calculate_post_rejects_invalid_param_type(client):
    response = await client.post(
        "/indicators/calculate",
        json={"close": [1, 2, 3], "indicators": ["ema"], "params": {"ema_period": "bad"}},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_calculate_post_limits_input_size(client):
    response = await client.post(
        "/indicators/calculate",
        json={"close": [1.0] * 5001, "indicators": ["ema"], "params": {}},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_indicator_response_converts_nan_to_null(client):
    response = await client.post(
        "/indicators/calculate",
        json={"close": [1, 2, 3, 4, 5], "indicators": ["sma"], "params": {"sma_period": 3}},
    )
    data = response.json()
    assert response.status_code == 200
    assert data["results"]["sma"][0] is None
    assert data["results"]["sma"][1] is None
    assert data["results"]["sma"][2] == 2.0


@pytest.mark.asyncio
async def test_get_symbol_returns_no_candles_when_empty(client):
    response = await client.get("/indicators/SBIN?timeframe=1m")
    data = response.json()
    assert response.status_code == 200
    assert data["available"] is False
    assert data["reason"] == "NO_CANDLES"
    assert data["count"] == 0


@pytest.mark.asyncio
async def test_get_symbol_with_mock_candles_returns_results(client, indicator_app):
    indicator_app.state.candle_store.load_historical(
        "SBIN",
        "1m",
        [
            {
                "time": 1000 + index * 60,
                "open": float(index + 1),
                "high": float(index + 2),
                "low": float(index),
                "close": float(index + 1),
                "volume": 1000 + index,
            }
            for index in range(60)
        ],
    )
    response = await client.get("/indicators/SBIN?timeframe=1m&names=ema,rsi,macd,vwap&ema_period=3&rsi_period=3")
    data = response.json()
    assert response.status_code == 200
    assert data["available"] is True
    assert data["count"] == 60
    assert "ema" in data["results"]
    assert "macd" in data["results"]
    assert "vwap" in data["results"]


def test_api_server_import_safe():
    import backend.api_server  # noqa: F401
