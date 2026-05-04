from collections import deque
from datetime import datetime, timezone
from typing import TypedDict


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class HealthEvent(TypedDict):
    ts: str
    component: str
    state: str
    detail: str


class HealthTimeline:
    MAX_EVENTS = 200

    def __init__(self):
        self._events: deque[HealthEvent] = deque(maxlen=self.MAX_EVENTS)
        self._current_states: dict[str, str] = {}

    def record_state_change(
        self, component: str, new_state: str, detail: str = ""
    ) -> None:
        normalized_component = str(component or "").strip().lower()
        normalized_state = str(new_state or "").strip().upper()
        if not normalized_component or not normalized_state:
            return
        if self._current_states.get(normalized_component) == normalized_state:
            return
        self._current_states[normalized_component] = normalized_state
        self._events.append({
            "ts": _utc_now(),
            "component": normalized_component,
            "state": normalized_state,
            "detail": str(detail or ""),
        })

    def get_timeline(self, component: str | None = None, limit: int = 50) -> list[HealthEvent]:
        safe_limit = min(max(int(limit or 50), 1), self.MAX_EVENTS)
        normalized_component = component.strip().lower() if component else None
        events = list(self._events)
        if normalized_component:
            events = [event for event in events if event["component"] == normalized_component]
        return events[-safe_limit:]

    def current_states(self) -> dict[str, str]:
        return dict(self._current_states)

    def downtime_incidents(self) -> list[dict]:
        incidents: list[dict] = []
        open_by_component: dict[str, HealthEvent] = {}

        for event in self._events:
            component = event["component"]
            state = event["state"].upper()
            if state in {"ERROR", "DISCONNECTED"} and component not in open_by_component:
                open_by_component[component] = event
                continue

            if state == "CONNECTED" and component in open_by_component:
                started = open_by_component.pop(component)
                incidents.append(_incident(component, started["ts"], event["ts"]))

        for component, started in open_by_component.items():
            incidents.append({
                "component": component,
                "started_at": started["ts"],
                "ended_at": None,
                "duration_seconds": None,
            })

        return incidents


def _incident(component: str, started_at: str, ended_at: str) -> dict:
    return {
        "component": component,
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_seconds": _duration_seconds(started_at, ended_at),
    }


def _duration_seconds(started_at: str, ended_at: str) -> float | None:
    try:
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return max((end - start).total_seconds(), 0.0)
