from datetime import datetime, timezone

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from backend.candles.candle_store import CandleStore
from backend.discovery.market_board import MarketBoard
from backend.discovery.screener_engine import ScreenerEngine
from backend.gateway import instrument_registry
from backend.gateway.instrument_loader import InstrumentLoader
from backend.routers.discovery import router as discovery_router


class FakeMarketWatch:
    def __init__(self, rows):
        self._rows = rows
        self.symbols = [row["symbol"] for row in rows]

    def snapshot(self):
        return [row.copy() for row in self._rows]


class FakeIndicatorEngine:
    def rsi(self, close, period=14):
        value = 25.0 if close[-1] < 100 else 40.0
        return [float("nan")] * (len(close) - 1) + [value]

    def ema(self, close, period):
        return [float("nan")] * (len(close) - 1) + [sum(close[-min(period, len(close)):]) / min(period, len(close))]

    def vwap(self, candles):
        return [float("nan")] * (len(candles) - 1) + [candles[-1]["close"]]


@pytest.fixture(autouse=True)
def reset_registry():
    instrument_registry._CACHE = None
    instrument_registry._MASTER_SOURCE = "fallback"
    yield
    instrument_registry._CACHE = None
    instrument_registry._MASTER_SOURCE = "fallback"


def market_rows():
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return [
        {"symbol": "AAA-EQ", "ltp": 95.0, "change_pct": 2.5, "volume": 1000, "last_update": now, "stale": False},
        {"symbol": "BBB-EQ", "ltp": 110.0, "change_pct": 5.0, "volume": 3000, "last_update": now, "stale": False},
        {"symbol": "CCC-EQ", "ltp": 90.0, "change_pct": -1.0, "volume": 2000, "last_update": now, "stale": False},
    ]


def seed_store() -> CandleStore:
    store = CandleStore()
    store.load_historical(
        "AAA-EQ",
        "1m",
        [
            {"time": 1000 + idx * 60, "open": 90, "high": 96, "low": 89, "close": 95, "volume": 1000}
            for idx in range(20)
        ],
    )
    store.load_historical(
        "BBB-EQ",
        "1m",
        [
            {"time": 1000 + idx * 60, "open": 105, "high": 112, "low": 104, "close": 110, "volume": 2000}
            for idx in range(20)
        ],
    )
    return store


def test_market_board_gainers_empty_when_no_ticks():
    board = MarketBoard(FakeMarketWatch([]))
    assert board.gainers() == []


def test_market_board_gainers_sorted_correctly():
    board = MarketBoard(FakeMarketWatch(market_rows()))
    gainers = board.gainers()
    assert [row["symbol"] for row in gainers[:2]] == ["BBB-EQ", "AAA-EQ"]


def test_market_board_losers_sorted():
    board = MarketBoard(FakeMarketWatch(market_rows()))
    losers = board.losers()
    assert losers[0]["symbol"] == "CCC-EQ"


@pytest.mark.asyncio
async def test_screener_rsi_filter():
    engine = ScreenerEngine(FakeIndicatorEngine(), seed_store(), FakeMarketWatch(market_rows()))
    result = await engine.run_screen({"rsi_below": 30}, timeframe="1m")
    assert [row["symbol"] for row in result["results"]] == ["AAA-EQ"]


@pytest.mark.asyncio
async def test_screener_no_candle_data_skips_symbol():
    store = seed_store()
    engine = ScreenerEngine(FakeIndicatorEngine(), store, FakeMarketWatch(market_rows()))
    result = await engine.run_screen({"change_pct_below": 0}, timeframe="1m")
    assert all(row["symbol"] != "CCC-EQ" for row in result["results"])


@pytest.mark.asyncio
async def test_screener_empty_filters_returns_all():
    engine = ScreenerEngine(FakeIndicatorEngine(), seed_store(), FakeMarketWatch(market_rows()))
    result = await engine.run_screen({}, timeframe="1m")
    assert result["symbols_passed"] == 2


def test_instrument_loader_filter_nse_equity():
    loader = InstrumentLoader()
    rows = [
        {"exch_seg": "NSE", "symbol": "SBIN-EQ", "token": "1", "name": "SBIN", "lotsize": "1"},
        {"exch_seg": "NFO", "symbol": "SBIN-EQ", "token": "2", "name": "SBIN FUT"},
        {"exch_seg": "NSE", "symbol": "SBIN-BL", "token": "3", "name": "SBIN BL"},
    ]
    filtered = loader.filter_nse_equity(rows)
    assert len(filtered) == 1
    assert filtered[0]["symbol"] == "SBIN-EQ"


def test_instrument_loader_maps_clean_symbol():
    loader = InstrumentLoader()
    filtered = loader.filter_nse_equity([
        {"exch_seg": "NSE", "symbol": "SBIN-EQ", "token": "1", "name": "SBIN"}
    ])
    assert filtered[0]["clean_symbol"] == "SBIN"


def test_registry_load_from_master_count():
    rows = [
        {"symbol": f"TEST{idx}-EQ", "clean_symbol": f"TEST{idx}", "token": str(idx), "exchange": "NSE"}
        for idx in range(5)
    ]
    assert instrument_registry.load_from_master(rows) == 5
    assert instrument_registry.registry_status()["loaded"] == 5


def test_registry_get_sectors():
    instrument_registry.load_from_master([
        {"symbol": "A-EQ", "clean_symbol": "A", "token": "1", "exchange": "NSE", "sector": "BANKING"},
        {"symbol": "B-EQ", "clean_symbol": "B", "token": "2", "exchange": "NSE", "sector": "BANKING"},
    ])
    assert "BANKING" in instrument_registry.get_sectors()


@pytest.fixture
def discovery_app():
    instrument_registry.load_from_master([
        {"symbol": "AAA-EQ", "clean_symbol": "AAA", "token": "1", "exchange": "NSE", "sector": "BANKING", "name": "AAA"},
        {"symbol": "BBB-EQ", "clean_symbol": "BBB", "token": "2", "exchange": "NSE", "sector": "IT", "name": "BBB"},
    ])
    app = FastAPI()
    app.include_router(discovery_router)
    store = seed_store()
    mw = FakeMarketWatch(market_rows())
    app.state.candle_store = store
    app.state.market_watch_state = mw
    app.state.screener_engine = ScreenerEngine(FakeIndicatorEngine(), store, mw)
    app.state.market_board = MarketBoard(mw)
    return app


@pytest_asyncio.fixture
async def client(discovery_app):
    transport = ASGITransport(app=discovery_app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_discovery_board_route(client):
    response = await client.get("/discovery/board")
    data = response.json()
    assert response.status_code == 200
    assert "summary" in data
    assert "gainers" in data
    assert "losers" in data


@pytest.mark.asyncio
async def test_screener_route(client):
    response = await client.post("/discovery/screener", json={"filters": {"rsi_below": 30}, "timeframe": "1m", "limit": 20})
    data = response.json()
    assert response.status_code == 200
    assert "results" in data
    assert isinstance(data["results"], list)

