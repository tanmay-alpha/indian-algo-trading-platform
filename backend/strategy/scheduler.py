# backend/strategy/scheduler.py

import asyncio
import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from backend.db.repositories.strategy_repository import StrategyRepository

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_str() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class StrategyScheduler:
    """
    Controlled StrategyScheduler that periodically evaluates RUNNING strategies in PAPER mode only.
    Enforces cooldown, max signals per day, and candle duplicate rules.
    """
    def __init__(self, session_factory: Any, runtime_manager: Any):
        self.session_factory = session_factory
        self.runtime_manager = runtime_manager
        self.repo = StrategyRepository()
        self._loop_task: Optional[asyncio.Task] = None
        self._running = False
        self.last_tick_time: Optional[datetime] = None

    async def start(self):
        """Starts the scheduler background loop if not already running."""
        if self._running:
            return
        self._running = True
        self._loop_task = asyncio.create_task(self._run_loop())
        logger.info("StrategyScheduler background loop started.")

    async def stop(self):
        """Stops the scheduler background loop."""
        if not self._running:
            return
        self._running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None
        logger.info("StrategyScheduler background loop stopped.")

    @property
    def is_running(self) -> bool:
        return self._running

    async def _run_loop(self):
        """Periodic loop checking and executing tick_once every 1.0 second."""
        while self._running:
            try:
                await self.tick_once()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in StrategyScheduler background tick loop: %s", e)
            try:
                await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                break

    async def tick_once(self):
        """
        Runs one tick of the scheduler:
        1. Queries all RUNNING strategies.
        2. Determines which strategies are due for evaluation.
        3. Invokes evaluate_symbol on the strategy runtime manager for each symbol.
        4. Updates evaluation timestamps in the database.
        """
        self.last_tick_time = _utc_now()
        session = self.session_factory()
        try:
            running_configs = self.repo.list_strategy_configs(session, status="RUNNING")
            now = self.last_tick_time
            
            for config in running_configs:
                due = False
                if not config.next_evaluation_at:
                    due = True
                else:
                    try:
                        cleaned_ts = config.next_evaluation_at.replace("Z", "+00:00")
                        next_eval = datetime.fromisoformat(cleaned_ts)
                        if next_eval.tzinfo is None:
                            next_eval = next_eval.replace(tzinfo=timezone.utc)
                        if now >= next_eval:
                            due = True
                    except Exception as e:
                        logger.error("Error parsing next_evaluation_at for strategy ID %s: %s", config.id, e)
                        due = True

                if due:
                    logger.info("Strategy ID %s ('%s') is due for evaluation.", config.id, config.name)
                    symbols = []
                    if config.symbols:
                        try:
                            symbols = json.loads(config.symbols) if isinstance(config.symbols, str) else config.symbols
                        except Exception as e:
                            logger.error("Error parsing symbols for strategy ID %s: %s", config.id, e)

                    # Trigger evaluation for each symbol
                    for symbol in symbols:
                        try:
                            await self.runtime_manager.evaluate_symbol(config, symbol, session=session)
                        except Exception as e:
                            logger.error("Error evaluating symbol %s on strategy ID %s: %s", symbol, config.id, e)

                    # Update evaluation timestamps
                    now_str = _utc_now_str()
                    interval = config.evaluation_interval_seconds or 60
                    next_eval_dt = now + timedelta(seconds=interval)
                    next_eval_str = next_eval_dt.isoformat().replace("+00:00", "Z")

                    config.last_evaluated_at = now_str
                    config.next_evaluation_at = next_eval_str
                    config.updated_at = now_str
                    session.add(config)
                    session.commit()
                    logger.info(
                        "Strategy ID %s timestamps updated: last_evaluated_at=%s, next_evaluation_at=%s",
                        config.id,
                        now_str,
                        next_eval_str,
                    )
        except Exception as e:
            logger.error("Error running StrategyScheduler.tick_once: %s", e)
            session.rollback()
        finally:
            session.close()

    def get_status(self) -> dict:
        """Returns the current status of the scheduler."""
        session = self.session_factory()
        running_ids = []
        try:
            configs = self.repo.list_strategy_configs(session, status="RUNNING")
            running_ids = [c.id for c in configs]
        except Exception as e:
            logger.error("Error listing running strategy configs for status: %s", e)
        finally:
            session.close()

        next_tick = None
        if self._running and self.last_tick_time:
            next_tick = self.last_tick_time + timedelta(seconds=1.0)

        return {
            "is_running": self._running,
            "enabled": self._running,
            "active_tasks_count": len(running_ids),
            "last_tick_time": self.last_tick_time,
            "next_tick_time": next_tick,
            "running_strategy_ids": running_ids,
        }
