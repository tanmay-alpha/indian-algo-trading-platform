import asyncio
from typing import Optional


class TickBus:
    def __init__(self, maxsize: int = 10000):
        self._queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=maxsize)
        self._total = 0
        self._dropped = 0
        self._maxsize = maxsize

    async def put_nowait_safe(self, event: dict) -> bool:
        """
        Coroutine scheduled from WebSocket thread using asyncio.run_coroutine_threadsafe().
        Attempts queue.put_nowait(event).
        Returns True if queued, False if dropped.
        Must not block.
        Must update total/dropped counters safely inside the event loop.
        """
        self._total += 1
        try:
            self._queue.put_nowait(event)
            return True
        except asyncio.QueueFull:
            self._dropped += 1
            return False

    async def get(self) -> dict:
        """Await next event."""
        return await self._queue.get()

    def get_nowait(self) -> Optional[dict]:
        """Return event immediately or None if empty."""
        try:
            return self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    @property
    def drop_rate(self) -> float:
        if self._total == 0:
            return 0.0
        return self._dropped / self._total

    @property
    def size(self) -> int:
        return self._queue.qsize()

    def stats(self) -> dict:
        return {
            "total": self._total,
            "dropped": self._dropped,
            "drop_rate_pct": self.drop_rate * 100.0,
            "current_size": self.size,
            "maxsize": self._maxsize,
        }
