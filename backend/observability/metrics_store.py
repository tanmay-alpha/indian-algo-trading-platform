import asyncio
import logging
from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any


logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


class MetricsStore:
    """
    Stores rolling time-series data for system observability.
    All series capped at MAX_POINTS to prevent unbounded memory growth.
    Thread-safe reads. All writes happen in the asyncio event loop.
    """

    MAX_POINTS = 500

    def __init__(self):
        self._series: dict[str, deque] = {
            "tick_rate": deque(maxlen=self.MAX_POINTS),
            "drop_rate_pct": deque(maxlen=self.MAX_POINTS),
            "ws_client_count": deque(maxlen=self.MAX_POINTS),
            "event_bus_total": deque(maxlen=self.MAX_POINTS),
            "event_fail_count": deque(maxlen=self.MAX_POINTS),
            "candle_count": deque(maxlen=self.MAX_POINTS),
            "last_tick_age_secs": deque(maxlen=self.MAX_POINTS),
            "portfolio_equity": deque(maxlen=self.MAX_POINTS),
            "portfolio_drawdown": deque(maxlen=self.MAX_POINTS),
        }
        self._tick_count_last_sample = 0
        self._sample_count = 0
        self._started_at = _utc_now()
        self._lock = Lock()

    def record_sample(
        self,
        tick_count: int,
        drop_rate_pct: float,
        ws_clients: int,
        event_total: int,
        event_fails: int,
        candle_count: int,
        last_tick_age: float | None,
        equity: float,
        drawdown: float,
    ) -> None:
        """Record one metrics sample and compute tick rate since prior sample."""
        ts = _iso_now()
        tick_total = max(int(tick_count or 0), 0)
        tick_rate = max(tick_total - self._tick_count_last_sample, 0)
        self._tick_count_last_sample = tick_total

        sample = {
            "tick_rate": tick_rate,
            "drop_rate_pct": float(drop_rate_pct or 0.0),
            "ws_client_count": int(ws_clients or 0),
            "event_bus_total": int(event_total or 0),
            "event_fail_count": int(event_fails or 0),
            "candle_count": int(candle_count or 0),
            "last_tick_age_secs": float(last_tick_age) if last_tick_age is not None else 0.0,
            "portfolio_equity": float(equity or 0.0),
            "portfolio_drawdown": float(drawdown or 0.0),
        }
        with self._lock:
            for name, value in sample.items():
                self._series[name].append({"ts": ts, "value": value})
            self._sample_count += 1

    def get_series(self, name: str, limit: int = 60) -> list[dict]:
        """Return last `limit` points of named series. Empty list if unknown."""
        safe_limit = min(max(int(limit or 60), 1), self.MAX_POINTS)
        with self._lock:
            series = self._series.get(name)
            if series is None:
                return []
            return list(series)[-safe_limit:]

    def get_all_latest(self) -> dict:
        """Return latest value of every metric series as flat dict."""
        with self._lock:
            latest = {}
            for name, series in self._series.items():
                latest[name] = series[-1]["value"] if series else None
            return latest

    def all_series(self, limit: int = 60) -> dict[str, list[dict]]:
        safe_limit = min(max(int(limit or 60), 1), self.MAX_POINTS)
        with self._lock:
            return {name: list(series)[-safe_limit:] for name, series in self._series.items()}

    def summary(self) -> dict:
        """Return uptime, sample count, series names, latest values, and start time."""
        with self._lock:
            latest = {
                name: series[-1]["value"] if series else None
                for name, series in self._series.items()
            }
            sample_count = self._sample_count
            series_names = sorted(self._series.keys())
        return {
            "uptime_seconds": (_utc_now() - self._started_at).total_seconds(),
            "sample_count": sample_count,
            "series_names": series_names,
            "latest": latest,
            "started_at": self._started_at.isoformat().replace("+00:00", "Z"),
        }


async def start_sampler(
    metrics_store: MetricsStore,
    app_state,
    interval_seconds: int = 60,
) -> None:
    """
    Background asyncio task that records safe system metrics.
    Missing state attributes are treated as zero/unavailable.
    """
    safe_interval = max(int(interval_seconds or 60), 1)
    while True:
        try:
            metrics_store.record_sample(**_collect_sample(app_state))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.debug("Observability sampler skipped sample: %s", exc.__class__.__name__)
        await asyncio.sleep(safe_interval)


def _collect_sample(app_state) -> dict[str, Any]:
    tick_stats = _call_dict(getattr(app_state, "tick_bus", None), "stats")
    gateway_stats = _call_dict(getattr(app_state, "gateway", None), "status")
    event_stats = _call_dict(getattr(app_state, "event_bus", None), "get_stats")
    candle_stats = _call_dict(getattr(app_state, "candle_store", None), "stats")
    portfolio_summary = _call_dict(getattr(app_state, "portfolio_engine", None), "get_summary")
    broadcaster = getattr(app_state, "broadcaster", None)

    return {
        "tick_count": int(tick_stats.get("total") or gateway_stats.get("tick_count") or 0),
        "drop_rate_pct": float(tick_stats.get("drop_rate_pct") or gateway_stats.get("drop_rate_pct") or 0.0),
        "ws_clients": len(getattr(broadcaster, "active_connections", []) or []),
        "event_total": int(event_stats.get("total") or 0),
        "event_fails": int(event_stats.get("failed_handler_count") or 0),
        "candle_count": _total_candles(candle_stats),
        "last_tick_age": _optional_float(gateway_stats.get("last_tick_age_seconds")),
        "equity": float(portfolio_summary.get("equity") or 0.0),
        "drawdown": float(portfolio_summary.get("current_drawdown") or 0.0),
    }


def _call_dict(obj: Any, method_name: str) -> dict:
    if obj is None:
        return {}
    method = getattr(obj, method_name, None)
    if not callable(method):
        return {}
    try:
        value = method()
    except Exception:
        return {}
    return value if isinstance(value, dict) else {}


def _total_candles(stats: dict) -> int:
    total = 0
    counts = stats.get("candle_counts")
    if not isinstance(counts, dict):
        return 0
    for by_timeframe in counts.values():
        if not isinstance(by_timeframe, dict):
            continue
        for value in by_timeframe.values():
            try:
                total += int(value or 0)
            except (TypeError, ValueError):
                continue
    return total


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
