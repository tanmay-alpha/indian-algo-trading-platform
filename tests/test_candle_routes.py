from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from backend.candles.candle_store import CandleStore
from backend.routers.candles import router


@pytest.fixture
def candle_app():
    app = FastAPI()
    app.include_router(router)
    store = CandleStore()
    store.load_historical(
        "SBIN",
        "1m",
        [
            {"time": 1000 + index * 60, "open": 750.0, "high": 751.0, "low": 749.0, "close": 750.5, "volume": 1000}
            for index in range(5)
        ],
    )
    app.state.candle_store = store
    app.state.session_manager = SimpleNamespace(is_valid=True)
    app.state.candle_fetcher = SimpleNamespace(
        fetch_and_load=AsyncMock(return_value={"fetched": 10, "loaded": 10, "error": None})
    )
    return app


@pytest_asyncio.fixture
async def client(candle_app):
    transport = ASGITransport(app=candle_app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_get_candles_cached(client):
    response = await client.get("/candles/SBIN?timeframe=1m")
    data = response.json()
    assert response.status_code == 200
    assert len(data["candles"]) == 5
    assert data["source"] == "cache"


@pytest.mark.asyncio
async def test_get_candles_empty_symbol(client):
    response = await client.get("/candles/FAKEXYZ?timeframe=1m")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_candles_invalid_timeframe(client):
    response = await client.get("/candles/SBIN?timeframe=3m")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_candles_with_fetch_calls_fetcher(client, candle_app):
    response = await client.get("/candles/SBIN?timeframe=1m&fetch=true")
    data = response.json()
    assert response.status_code == 200
    assert data["fetch_result"] is not None
    candle_app.state.candle_fetcher.fetch_and_load.assert_awaited_once()


@pytest.mark.asyncio
async def test_post_fetch_success(client):
    response = await client.post("/candles/SBIN/fetch", json={"timeframe": "1m", "from_dt": None, "to_dt": None})
    assert response.status_code == 200
    assert response.json()["error"] is None


@pytest.mark.asyncio
async def test_post_fetch_session_invalid(client, candle_app):
    candle_app.state.session_manager.is_valid = False
    response = await client.post("/candles/SBIN/fetch", json={"timeframe": "1m", "from_dt": None, "to_dt": None})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_candle_status_route(client):
    response = await client.get("/candles/status")
    data = response.json()
    assert response.status_code == 200
    assert "supported_timeframes" in data


@pytest.mark.asyncio
async def test_candles_include_live_flag(client, candle_app):
    candle_app.state.candle_store._update_live_candle(
        "SBIN",
        752.0,
        1200,
        datetime(2024, 1, 2, 9, 20, 0, tzinfo=timezone.utc),
    )
    response = await client.get("/candles/SBIN?timeframe=1m")
    candles = response.json()["candles"]
    assert candles[-1]["is_live"] is True
