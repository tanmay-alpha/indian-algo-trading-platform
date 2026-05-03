import asyncio
from collections import defaultdict, deque
from typing import Awaitable, Callable, Optional

from loguru import logger

from backend.core.events import AnyEvent, event_to_dict, get_event_type


class EventBus:
    def __init__(self, history_size: int = 1000):
        self._handlers: dict[str, list[Callable[[AnyEvent], Awaitable[None]]]] = defaultdict(list)
        self._history: deque[AnyEvent] = deque(maxlen=history_size)
        self._event_count: dict[str, int] = defaultdict(int)
        self._failed_handler_count = 0

    def subscribe(self, event_type: str, handler: Callable[[AnyEvent], Awaitable[None]]) -> None:
        """Register async handler."""
        self._handlers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: Callable[[AnyEvent], Awaitable[None]]) -> None:
        """Remove handler safely if present."""
        if handler in self._handlers.get(event_type, []):
            self._handlers[event_type].remove(handler)

    async def publish(self, event: AnyEvent) -> None:
        """
        Add to history.
        Increment count.
        Dispatch to all handlers for this event_type.
        Also dispatch to wildcard '*' handlers if any.
        Run handlers concurrently with asyncio.gather(return_exceptions=True).
        Catch/log handler exceptions without stopping other handlers.
        Never raise because one handler failed.
        """
        event_type = get_event_type(event)
        self._history.append(event)
        self._event_count[event_type] += 1

        handlers = list(self._handlers.get(event_type, []))
        handlers.extend(self._handlers.get("*", []))
        if not handlers:
            return

        results = await asyncio.gather(
            *(handler(event) for handler in handlers),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                self._failed_handler_count += 1
                logger.error(f"Event handler failed: {result.__class__.__name__}")

    def get_stats(self) -> dict:
        return {
            "total": sum(self._event_count.values()),
            "by_type": dict(self._event_count),
            "failed_handler_count": self._failed_handler_count,
            "history_size": len(self._history),
        }

    def get_recent(self, event_type: Optional[str] = None, limit: int = 50) -> list[dict]:
        """
        Return serialized recent events.
        Newest last.
        Filter by event_type if provided.
        """
        events = [
            event for event in self._history
            if event_type is None or get_event_type(event) == event_type
        ]
        return [event_to_dict(event) for event in events[-limit:]]

    def clear_history(self) -> None:
        """Clear rolling history only, not counters."""
        self._history.clear()
