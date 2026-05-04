from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from backend.observability.event_log import ObservabilityEventLog
from backend.observability.health_timeline import HealthTimeline
from backend.observability.metrics_store import MetricsStore


router = APIRouter(prefix="/observability", tags=["observability"])
prometheus_router = APIRouter(tags=["observability"])


@router.get("/metrics")
def observability_metrics(request: Request, limit: int = Query(default=60, ge=1, le=500)):
    metrics = _metrics(request)
    return {
        "summary": metrics.summary(),
        "series": metrics.all_series(limit=limit),
        "note": "Rolling window, last 500 samples (max 8 hours at 1-min interval)",
    }


@router.get("/metrics/{series_name}")
def observability_metric_series(
    series_name: str,
    request: Request,
    limit: int = Query(default=60, ge=1, le=500),
):
    metrics = _metrics(request)
    if series_name not in metrics.summary()["series_names"]:
        raise HTTPException(status_code=404, detail="Unknown metric series")
    return {"series_name": series_name, "points": metrics.get_series(series_name, limit=limit)}


@router.get("/events/errors")
def observability_error_events(request: Request, limit: int = Query(default=50, ge=1, le=500)):
    return {"entries": _event_log(request).error_entries(limit), "count": len(_event_log(request).error_entries(limit))}


@router.get("/events")
def observability_events(
    request: Request,
    event_type: str | None = None,
    symbol: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return _event_log(request).query(event_type=event_type, symbol=symbol, limit=limit, offset=offset)


@router.get("/health-timeline/incidents")
def observability_health_incidents(request: Request):
    return {"incidents": _timeline(request).downtime_incidents()}


@router.get("/health-timeline")
def observability_health_timeline(
    request: Request,
    component: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    timeline = _timeline(request)
    return {
        "events": timeline.get_timeline(component=component, limit=limit),
        "current_states": timeline.current_states(),
    }


@router.get("/strategy-runs")
def observability_strategy_runs(request: Request):
    runs = list(getattr(request.app.state, "backtest_history", []) or [])
    return {"runs": runs, "count": len(runs)}


@router.get("/status")
def observability_status(request: Request):
    metrics = _metrics(request)
    event_log = _event_log(request)
    timeline = _timeline(request)
    sampler_task = getattr(request.app.state, "sampler_task", None)
    stats = event_log.stats()
    return {
        "metrics_samples": metrics.summary()["sample_count"],
        "event_log_entries": stats["total"],
        "health_events": len(timeline.get_timeline(limit=timeline.MAX_EVENTS)),
        "uptime_seconds": metrics.summary()["uptime_seconds"],
        "error_count": stats["error_count"],
        "sampler_running": bool(sampler_task and not sampler_task.done()),
    }


@prometheus_router.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics(request: Request):
    latest = _metrics(request).get_all_latest()
    tick_bus = getattr(request.app.state, "tick_bus", None)
    tick_stats = tick_bus.stats() if tick_bus else {}
    text = "\n".join([
        "# HELP maet_tick_count_total Total ticks received",
        "# TYPE maet_tick_count_total counter",
        f"maet_tick_count_total {int(tick_stats.get('total') or 0)}",
        "# HELP maet_dropped_tick_count_total Total ticks dropped",
        "# TYPE maet_dropped_tick_count_total counter",
        f"maet_dropped_tick_count_total {int(tick_stats.get('dropped') or 0)}",
        "# HELP maet_ws_clients Current WebSocket clients",
        "# TYPE maet_ws_clients gauge",
        f"maet_ws_clients {int(latest.get('ws_client_count') or 0)}",
        "# HELP maet_event_total Total EventBus events",
        "# TYPE maet_event_total counter",
        f"maet_event_total {int(latest.get('event_bus_total') or 0)}",
        "# HELP maet_event_fails Total EventBus handler failures",
        "# TYPE maet_event_fails counter",
        f"maet_event_fails {int(latest.get('event_fail_count') or 0)}",
        "# HELP maet_portfolio_equity Current portfolio equity",
        "# TYPE maet_portfolio_equity gauge",
        f"maet_portfolio_equity {float(latest.get('portfolio_equity') or 0.0)}",
        "# HELP maet_portfolio_drawdown Current portfolio drawdown",
        "# TYPE maet_portfolio_drawdown gauge",
        f"maet_portfolio_drawdown {float(latest.get('portfolio_drawdown') or 0.0)}",
        "",
    ])
    return PlainTextResponse(text, media_type="text/plain; version=0.0.4")


def _metrics(request: Request) -> MetricsStore:
    metrics = getattr(request.app.state, "obs_metrics", None)
    if metrics is None:
        metrics = MetricsStore()
        request.app.state.obs_metrics = metrics
    return metrics


def _event_log(request: Request) -> ObservabilityEventLog:
    event_log = getattr(request.app.state, "obs_event_log", None)
    if event_log is None:
        event_log = ObservabilityEventLog()
        request.app.state.obs_event_log = event_log
    return event_log


def _timeline(request: Request) -> HealthTimeline:
    timeline = getattr(request.app.state, "obs_timeline", None)
    if timeline is None:
        timeline = HealthTimeline()
        request.app.state.obs_timeline = timeline
    return timeline
