import json
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, TypedDict

from backend.core.events import event_to_dict
from backend.core.security import sanitize_response


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class EventLogEntry(TypedDict):
    id: int
    event_type: str
    symbol: str | None
    summary: str
    payload_preview: str
    ts: str


class ObservabilityEventLog:
    MAX_ENTRIES = 2000

    def __init__(self):
        self._entries: deque[EventLogEntry] = deque(maxlen=self.MAX_ENTRIES)
        self._counters: dict[str, int] = defaultdict(int)
        self._next_id = 1
        self._error_count = 0

    def record(self, event) -> None:
        """Record a compact, sanitized event log entry."""
        payload = _event_payload(event)
        event_type = _event_type(event, payload)
        symbol = _safe_str(payload.get("symbol") or getattr(event, "symbol", None))
        summary = _summary(event_type, payload)
        entry: EventLogEntry = {
            "id": self._next_id,
            "event_type": event_type,
            "symbol": symbol,
            "summary": summary,
            "payload_preview": _payload_preview(payload),
            "ts": _event_ts(event, payload),
        }
        self._entries.append(entry)
        self._counters[event_type] += 1
        if event_type == "ERROR" or (
            event_type == "GATEWAY_STATUS" and str(payload.get("status", "")).upper() == "ERROR"
        ):
            self._error_count += 1
        self._next_id += 1

    def query(
        self,
        event_type: str | None = None,
        symbol: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        safe_limit = min(max(int(limit or 100), 1), self.MAX_ENTRIES)
        safe_offset = max(int(offset or 0), 0)
        normalized_type = event_type.strip().upper() if event_type else None
        normalized_symbol = symbol.strip().upper() if symbol else None

        entries = list(self._entries)
        if normalized_type:
            entries = [entry for entry in entries if entry["event_type"].upper() == normalized_type]
        if normalized_symbol:
            entries = [
                entry for entry in entries
                if (entry.get("symbol") or "").upper() == normalized_symbol
            ]

        total_matched = len(entries)
        page = entries[safe_offset:safe_offset + safe_limit]
        return {
            "entries": page,
            "total_matched": total_matched,
            "total_stored": len(self._entries),
            "filters": {"event_type": event_type, "symbol": symbol},
        }

    def error_entries(self, limit: int = 50) -> list[EventLogEntry]:
        safe_limit = min(max(int(limit or 50), 1), self.MAX_ENTRIES)
        errors = [
            entry for entry in self._entries
            if entry["event_type"] == "ERROR"
            or (entry["event_type"] == "GATEWAY_STATUS" and "ERROR" in entry["summary"].upper())
        ]
        return errors[-safe_limit:]

    def stats(self) -> dict:
        return {
            "by_type": dict(self._counters),
            "total": len(self._entries),
            "error_count": self._error_count,
        }


def _event_payload(event: Any) -> dict:
    if isinstance(event, dict):
        return sanitize_response(event)
    try:
        return sanitize_response(event_to_dict(event))
    except Exception:
        raw = getattr(event, "__dict__", {})
        return sanitize_response(raw if isinstance(raw, dict) else {})


def _event_type(event: Any, payload: dict) -> str:
    raw = payload.get("event_type") or getattr(event, "event_type", None) or event.__class__.__name__
    return str(raw or "UNKNOWN").upper()


def _event_ts(event: Any, payload: dict) -> str:
    value = payload.get("occurred_at") or payload.get("received_at") or getattr(event, "occurred_at", None)
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if value:
        return str(value)
    return _utc_now()


def _summary(event_type: str, payload: dict) -> str:
    if event_type == "TICK":
        return f"TICK {payload.get('symbol') or '-'} LTP={payload.get('ltp')}"
    if event_type == "SIGNAL":
        return f"SIGNAL {payload.get('strategy_name') or '-'} {payload.get('action') or '-'} {payload.get('symbol') or '-'}"
    if event_type == "GATEWAY_STATUS":
        return f"GW {payload.get('status') or payload.get('connection_state') or '-'}"
    if event_type == "ORDER_STATE":
        return f"ORDER {payload.get('order_id') or '-'} {payload.get('status') or '-'}"
    if event_type == "PORTFOLIO":
        return f"PORTFOLIO equity={payload.get('equity')}"
    if event_type == "SESSION":
        return f"SESSION {payload.get('status') or '-'}"
    if event_type == "ERROR":
        detail = payload.get("safe_message") or payload.get("detail") or payload.get("message") or ""
        return f"ERROR {str(detail)[:50]}"
    return event_type


def _payload_preview(payload: dict) -> str:
    try:
        return json.dumps(payload, default=str, separators=(",", ":"))[:200]
    except Exception:
        return "{}"


def _safe_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
