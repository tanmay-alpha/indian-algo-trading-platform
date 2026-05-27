from datetime import datetime, timezone
from typing import Optional

from backend.core.events import LogEvent, SystemHealthEvent, ErrorEvent


def _utc_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class KillSwitchService:
    def __init__(self, event_bus=None, default_active: bool = True):
        self._active = default_active
        self._reason: Optional[str] = "Initial safety lock active" if default_active else None
        self._updated_at: str = _utc_ts()
        self._updated_by: Optional[str] = "SYSTEM"
        self._audit: list[dict] = []
        self._event_bus = event_bus

    @property
    def is_active(self) -> bool:
        return self._active

    @property
    def reason(self) -> Optional[str]:
        return self._reason

    @property
    def updated_at(self) -> str:
        return self._updated_at

    @property
    def updated_by(self) -> Optional[str]:
        return self._updated_by

    def activate(self, reason: str, source: str = "SYSTEM") -> None:
        self._active = True
        self._reason = reason or "Kill switch activated"
        self._updated_at = _utc_ts()
        self._updated_by = source
        self._record("ACTIVATE", source, self._reason)
        self._publish(LogEvent(level="WARNING", component="KILL_SWITCH", message=f"Kill switch activated: {self._reason}"))
        self._publish(
            ErrorEvent(
                component="KILL_SWITCH",
                error_type="KILL_SWITCH_ACTIVATED",
                safe_message=f"Kill switch activated: {self._reason}",
                severity="CRITICAL",
            )
        )
        self._publish(
            SystemHealthEvent(
                component="KILL_SWITCH",
                status="ACTIVE",
                detail="Execution blocked",
                metrics={"active": True},
            )
        )

    def deactivate(self, confirm: bool = False, source: str = "SYSTEM") -> bool:
        if not confirm:
            self._record("DEACTIVATE_REJECTED", source, "confirm=True required")
            return False
        self._active = False
        self._reason = None
        self._updated_at = _utc_ts()
        self._updated_by = source
        self._record("DEACTIVATE", source, "Kill switch deactivated")
        self._publish(LogEvent(level="INFO", component="KILL_SWITCH", message="Kill switch deactivated"))
        self._publish(
            ErrorEvent(
                component="KILL_SWITCH",
                error_type="KILL_SWITCH_DEACTIVATED",
                safe_message="Kill switch deactivated",
                severity="INFO",
            )
        )
        return True

    def status(self) -> dict:
        return {
            "active": self._active,
            "reason": self._reason,
            "updated_at": self._updated_at,
            "updated_by": self._updated_by,
            "audit": list(self._audit),
        }

    def _record(self, action: str, source: str, reason: str) -> None:
        self._audit.append({"ts": _utc_ts(), "action": action, "source": source, "reason": reason})

    def _publish(self, event) -> None:
        if not self._event_bus:
            return
        try:
            import asyncio

            loop = asyncio.get_running_loop()
            loop.create_task(self._event_bus.publish(event))
        except RuntimeError:
            pass


class KillSwitch(KillSwitchService):
    def __init__(self, event_bus=None):
        super().__init__(event_bus=event_bus, default_active=False)

