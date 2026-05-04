from datetime import datetime, timezone
from typing import Any


class MarketBoard:
    NOTE = (
        "Data available only for subscribed symbols. "
        "Full NSE universe requires individual subscriptions."
    )

    def __init__(self, market_watch_state):
        self._mw = market_watch_state

    def gainers(self, limit: int = 10) -> list[dict]:
        rows = self._rows_with_ticks()
        if len(rows) < 2:
            return []
        return [
            self._mover(row)
            for row in sorted(rows, key=lambda item: item.get("change_pct") or 0, reverse=True)[:limit]
        ]

    def losers(self, limit: int = 10) -> list[dict]:
        rows = self._rows_with_ticks()
        if len(rows) < 2:
            return []
        return [
            self._mover(row)
            for row in sorted(rows, key=lambda item: item.get("change_pct") or 0)[:limit]
        ]

    def most_active(self, limit: int = 10) -> list[dict]:
        rows = [row for row in self._snapshot() if self._number(row.get("volume")) is not None]
        if len(rows) < 2:
            return []
        return [
            self._mover(row)
            for row in sorted(rows, key=lambda item: item.get("volume") or 0, reverse=True)[:limit]
        ]

    def summary(self) -> dict:
        rows = self._snapshot()
        with_data = [row for row in rows if self._number(row.get("ltp")) is not None]
        stale = [row for row in rows if row.get("stale")]
        last_updates = [str(row.get("last_update")) for row in rows if row.get("last_update")]
        return {
            "total_symbols_tracked": len(rows),
            "symbols_with_data": len(with_data),
            "symbols_stale": len(stale),
            "last_updated": max(last_updates) if last_updates else None,
            "note": self.NOTE,
        }

    def _rows_with_ticks(self) -> list[dict]:
        return [
            row
            for row in self._snapshot()
            if self._number(row.get("ltp")) is not None and self._number(row.get("change_pct")) is not None
        ]

    def _snapshot(self) -> list[dict]:
        if self._mw is None:
            return []
        if hasattr(self._mw, "snapshot"):
            try:
                rows = self._mw.snapshot()
                return [row for row in rows if isinstance(row, dict)]
            except Exception:
                return []
        if isinstance(self._mw, dict):
            return [row for row in self._mw.values() if isinstance(row, dict)]
        return []

    def _mover(self, row: dict[str, Any]) -> dict:
        return {
            "symbol": str(row.get("symbol") or ""),
            "ltp": self._number(row.get("ltp")),
            "change_pct": self._number(row.get("change_pct")),
            "volume": self._int_or_none(row.get("volume")),
            "is_live": bool(row.get("last_update")) and not bool(row.get("stale")),
        }

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            parsed = float(value)
            return parsed if parsed == parsed else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _int_or_none(value: Any) -> int | None:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

