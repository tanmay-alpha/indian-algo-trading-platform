import time
import asyncio
from typing import List

class RateLimitExceeded(Exception):
    pass


class BrokerRateLimiter:
    def __init__(
        self,
        max_requests: int = 3,
        window_seconds: float = 1.0,
        max_rate_per_sec: float = 3.0,
        max_rate_per_min: float = 10.0
    ):
        # Support both constructor forms
        self.max_requests = int(max_requests if max_requests != 3 else max_rate_per_sec)
        self.window_seconds = window_seconds
        self.max_rate_per_min = int(max_rate_per_min)
        self._requests: List[float] = []
        self._requests_min: List[float] = []
        self._lock = asyncio.Lock()

    async def allow_request(self) -> bool:
        """
        Asynchronously check if request is allowed within the sliding window.
        """
        async with self._lock:
            now = time.time()
            # Remove requests outside the sliding window
            self._requests = [t for t in self._requests if now - t < self.window_seconds]
            self._requests_min = [t for t in self._requests_min if now - t < 60.0]
            
            if len(self._requests) < self.max_requests and len(self._requests_min) < self.max_rate_per_min:
                self._requests.append(now)
                self._requests_min.append(now)
                return True
            return False

    async def acquire(self) -> None:
        """
        Acquire rate limiting token, raising RateLimitExceeded if limits are hit.
        """
        if not await self.allow_request():
            raise RateLimitExceeded("Rate limit exceeded")

    def allow_request_sync(self) -> bool:
        """
        Synchronously check if request is allowed (non-blocking).
        """
        now = time.time()
        self._requests = [t for t in self._requests if now - t < self.window_seconds]
        self._requests_min = [t for t in self._requests_min if now - t < 60.0]
        if len(self._requests) < self.max_requests and len(self._requests_min) < self.max_rate_per_min:
            self._requests.append(now)
            self._requests_min.append(now)
            return True
        return False
