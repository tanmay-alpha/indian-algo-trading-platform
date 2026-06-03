from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from backend.observability.event_log import ObservabilityEventLog
from backend.observability.health_timeline import HealthTimeline
from backend.observability.metrics_store import MetricsStore
from backend.routers.observability import prometheus_router, router


def test_metrics_store_record_sample():
    store = MetricsStore()
    store.record_sample(10, 0.0, 1, 5, 0, 3, None, 100000.0, 0.0)
    latest = store.get_all_latest()
    assert latest["tick_rate"] == 10
    assert latest["portfolio_equity"] == 100000.0


def test_metrics_store_tick_rate_calculation():
    store = MetricsStore()
    store.record_sample(100, 0.0, 0, 0, 0, 0, None, 0.0, 0.0)
    store.record_sample(150, 0.0, 0, 0, 0, 0, None, 0.0, 0.0)
    assert store.get_series("tick_rate")[-1]["value"] == 50


def test_metrics_store_series_capped():
    store = MetricsStore()
    for index in range(600):
        store.record_sample(index, 0.0, 0, 0, 0, 0, None, 0.0, 0.0)
    assert len(store.get_series("tick_rate", limit=600)) == store.MAX_POINTS


def test_event_log_record_tick():
    log = ObservabilityEventLog()
    log.record(SimpleNamespace(event_type="TICK", symbol="SBIN", ltp=750.0))
    entry = log.query()["entries"][0]
    assert entry["summary"] == "TICK SBIN LTP=750.0"


def test_event_log_query_by_type():
    log = ObservabilityEventLog()
    log.record(SimpleNamespace(event_type="TICK", symbol="SBIN", ltp=750.0))
    log.record(SimpleNamespace(event_type="SIGNAL", symbol="SBIN", strategy_name="EMA", action="BUY"))
    result = log.query(event_type="TICK")
    assert result["total_matched"] == 1
    assert result["entries"][0]["event_type"] == "TICK"


def test_event_log_query_by_symbol():
    log = ObservabilityEventLog()
    log.record(SimpleNamespace(event_type="TICK", symbol="SBIN", ltp=750.0))
    log.record(SimpleNamespace(event_type="TICK", symbol="RELIANCE", ltp=2500.0))
    result = log.query(symbol="SBIN")
    assert result["total_matched"] == 1
    assert result["entries"][0]["symbol"] == "SBIN"


def test_event_log_pagination():
    log = ObservabilityEventLog()
    for index in range(100):
        log.record(SimpleNamespace(event_type="TICK", symbol=f"S{index}", ltp=float(index)))
    result = log.query(limit=10, offset=0)
    assert len(result["entries"]) == 10
    assert result["total_matched"] == 100


def test_health_timeline_deduplicates():
    timeline = HealthTimeline()
    timeline.record_state_change("gateway", "CONNECTED")
    timeline.record_state_change("gateway", "CONNECTED")
    assert len(timeline.get_timeline()) == 1


def test_health_timeline_state_change():
    timeline = HealthTimeline()
    timeline.record_state_change("gateway", "CONNECTED")
    timeline.record_state_change("gateway", "DISCONNECTED")
    timeline.record_state_change("gateway", "CONNECTED")
    incidents = timeline.downtime_incidents()
    assert len(incidents) == 1
    assert incidents[0]["ended_at"] is not None


@pytest.fixture
def observability_app():
    app = FastAPI()
    app.include_router(router)
    app.include_router(prometheus_router)
    app.state.obs_metrics = MetricsStore()
    app.state.obs_event_log = ObservabilityEventLog()
    app.state.obs_timeline = HealthTimeline()
    app.state.backtest_history = []
    app.state.obs_metrics.record_sample(10, 0.0, 1, 2, 0, 3, None, 100000.0, 0.0)
    app.state.obs_event_log.record(SimpleNamespace(event_type="TICK", symbol="SBIN", ltp=750.0))
    app.state.obs_event_log.record(SimpleNamespace(event_type="SIGNAL", symbol="SBIN", strategy_name="EMA", action="BUY"))
    app.state.obs_timeline.record_state_change("gateway", "CONNECTED")
    return app


@pytest_asyncio.fixture
async def client(observability_app):
    transport = ASGITransport(app=observability_app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-Admin-Token": "test-admin-token"},
    ) as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_observability_status_route(client):
    response = await client.get("/observability/status")
    data = response.json()
    assert response.status_code == 200
    assert "uptime_seconds" in data
    assert "event_log_entries" in data


@pytest.mark.asyncio
async def test_metrics_route(client):
    response = await client.get("/observability/metrics")
    data = response.json()
    assert response.status_code == 200
    assert "series" in data
    assert "tick_rate" in data["series"]


@pytest.mark.asyncio
async def test_events_route_filtered(client):
    response = await client.get("/observability/events?event_type=TICK")
    data = response.json()
    assert response.status_code == 200
    assert data["total_matched"] == 1
    assert all(entry["event_type"] == "TICK" for entry in data["entries"])


@pytest.mark.asyncio
async def test_prometheus_metrics_route(client):
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "maet_tick_count_total" in response.text
