from collections import deque
from datetime import datetime, timezone
from typing import Optional

from backend.core.config import settings


class EquityCurve:
    def __init__(self, initial_capital: Optional[float] = None, max_points: int = 5000):
        self.initial_capital = float(initial_capital if initial_capital is not None else 50000.0)
        self._points: deque[dict] = deque(maxlen=max_points)
        self._peak = self.initial_capital
        self._max_drawdown = 0.0

    def add_point(self, equity: float, timestamp: datetime | None = None) -> None:
        timestamp = timestamp or datetime.now(timezone.utc)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        equity = round(float(equity), 2)
        self._peak = max(self._peak, equity)
        drawdown = round(self._peak - equity, 2)
        self._max_drawdown = max(self._max_drawdown, drawdown)
        self._points.append({"timestamp": timestamp.isoformat(), "equity": equity, "drawdown": drawdown})

    def latest(self) -> dict | None:
        return self._points[-1] if self._points else None

    def get_points(self, limit: int = 500) -> list[dict]:
        limit = max(1, min(limit, 5000))
        return list(self._points)[-limit:]

    def current_drawdown(self) -> float:
        latest = self.latest()
        return float(latest["drawdown"]) if latest else 0.0

    def max_drawdown(self) -> float:
        return round(self._max_drawdown, 2)

    def summary(self) -> dict:
        latest = self.latest()
        return {
            "initial_capital": self.initial_capital,
            "latest_equity": latest["equity"] if latest else None,
            "points": len(self._points),
            "current_drawdown": self.current_drawdown(),
            "max_drawdown": self.max_drawdown(),
        }
