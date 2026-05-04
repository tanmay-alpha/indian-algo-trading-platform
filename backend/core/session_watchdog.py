import asyncio

from loguru import logger

from backend.core.config import settings
from backend.core.session_manager import SessionManager


class SessionWatchdog:
    def __init__(self, session_manager: SessionManager):
        self.session_manager = session_manager
        self._task: asyncio.Task | None = None
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    async def start(self):
        """Start one background watchdog task if not already running."""
        if self._task and not self._task.done():
            return

        self._running = True
        self._task = asyncio.create_task(self._watchdog_loop())

    async def stop(self):
        """Cancel watchdog task gracefully."""
        self._running = False
        if not self._task:
            return

        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None

    async def _watchdog_loop(self):
        """
        Loop every settings.jwt_refresh_interval_minutes.
        On each cycle:
        1. Check clock drift.
        2. Warn if drift > 10 seconds.
        3. session_manager.refresh()
        4. If refresh fails, retry after 5 minutes.
        5. If 3 consecutive failures, log CRITICAL and stop watchdog.
        """
        consecutive_failures = 0
        refresh_interval = settings.jwt_refresh_interval_minutes * 60

        try:
            while self._running:
                try:
                    self.session_manager.check_clock_drift()
                except RuntimeError as exc:
                    logger.critical(
                        "Clock drift check failed critically: %s; TODO: wire safe trading stop hook",
                        exc.__class__.__name__,
                    )  # SECURITY: redacted
                    self._running = False
                    break
                except Exception as exc:
                    logger.warning(f"Clock drift check failed: {exc.__class__.__name__}")

                refreshed = await self.session_manager.refresh()
                if refreshed:
                    consecutive_failures = 0
                    await asyncio.sleep(refresh_interval)
                    continue

                consecutive_failures += 1
                if consecutive_failures >= 3:
                    logger.critical("Session refresh failed 3 times; TODO: wire safe trading stop hook")
                    self._running = False
                    break

                await asyncio.sleep(300)
        except asyncio.CancelledError:
            self._running = False
            raise
        finally:
            self._running = False
