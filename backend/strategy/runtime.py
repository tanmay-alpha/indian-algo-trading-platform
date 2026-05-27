# backend/strategy/runtime.py

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Union

from backend.core.events import SignalEvent
from backend.db.models import StrategyConfigModel, StrategySignalModel
from backend.db.repositories.strategy_repository import StrategyRepository
from backend.indicators.engine import IndicatorEngine
from backend.strategy.backtest_engine import BacktestEngine
from backend.strategy.models import StrategyConfig

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class StrategyRuntimeManager:
    """
    Manages active running strategies, evaluates symbols using candles,
    persists generated signals, and routes them to paper execution via EventBus.
    
    Strictly restricted to paper/simulation pipelines; never calls execution routers
    or broker APIs directly.
    """
    def __init__(
        self,
        session_factory: Callable[[], Any],
        event_bus: Any,
        candle_store: Any,
        indicator_engine: Optional[IndicatorEngine] = None,
        backtest_engine: Optional[BacktestEngine] = None,
    ):
        self.session_factory = session_factory
        self.event_bus = event_bus
        self.candle_store = candle_store
        
        self.indicator_engine = indicator_engine or IndicatorEngine(prefer_cpp=False)
        self.backtest_engine = backtest_engine or BacktestEngine(indicator_engine=self.indicator_engine)
        self.repo = StrategyRepository()
        self._loop_task = None
        self.active_strategies = {}

    async def start_background_loop(self):
        """Starts the background evaluation loop."""
        if self._loop_task is None or self._loop_task.done():
            self._loop_task = asyncio.create_task(self._evaluation_loop())
            logger.info("Strategy runtime background evaluation loop started.")

    async def stop_background_loop(self):
        """Stops the background evaluation loop."""
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
            self._loop_task = None
            logger.info("Strategy runtime background evaluation loop stopped.")

    async def _evaluation_loop(self):
        """Background loop to evaluate running strategies periodically."""
        while True:
            try:
                await asyncio.sleep(5.0)  # Evaluate every 5 seconds
                session = self.session_factory()
                try:
                    running_configs = self.repo.list_strategy_configs(session, status="RUNNING")
                    for config in running_configs:
                        try:
                            # Evaluate strategy on all its symbols
                            await self.evaluate_strategy(config.id, session=session)
                        except Exception as e:
                            logger.error("Error evaluating strategy ID %s in background: %s", config.id, e)
                except Exception as e:
                    logger.error("Error in background strategy runtime loop DB fetch: %s", e)
                finally:
                    session.close()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Unexpected error in background evaluation loop: %s", e)

    def start_strategy(self, strategy_id: int, session: Optional[Any] = None) -> bool:
        """Transitions a strategy's database status to RUNNING."""
        own_session = False
        if session is None:
            session = self.session_factory()
            own_session = True
        try:
            config = self.repo.get_config_by_id(session, strategy_id)
            if not config:
                return False
            config = self.repo.update_strategy_status(session, strategy_id, "RUNNING")
            if config:
                self.active_strategies[strategy_id] = {
                    "status": "RUNNING",
                    "config": {
                        "id": config.id,
                        "name": config.name,
                        "template_id": config.template_id,
                        "symbols": self.repo.get_symbols(config),
                        "timeframe": config.timeframe,
                        "parameters": self.repo.get_parameters(config),
                        "mode": config.mode
                    }
                }
                logger.info("Strategy ID %s started successfully.", strategy_id)
                return True
            return False
        finally:
            if own_session:
                session.close()

    def stop_strategy(self, strategy_id: int, session: Optional[Any] = None) -> bool:
        """Transitions a strategy's database status to STOPPED."""
        own_session = False
        if session is None:
            session = self.session_factory()
            own_session = True
        try:
            config = self.repo.update_strategy_status(session, strategy_id, "STOPPED")
            if config:
                self.active_strategies.pop(strategy_id, None)
                logger.info("Strategy ID %s stopped successfully.", strategy_id)
                return True
            return False
        finally:
            if own_session:
                session.close()

    def pause_strategy(self, strategy_id: int, session: Optional[Any] = None) -> bool:
        """Transitions a strategy's database status to PAUSED."""
        own_session = False
        if session is None:
            session = self.session_factory()
            own_session = True
        try:
            config = self.repo.update_strategy_status(session, strategy_id, "PAUSED")
            if config:
                if strategy_id in self.active_strategies:
                    self.active_strategies[strategy_id]["status"] = "PAUSED"
                else:
                    self.active_strategies[strategy_id] = {
                        "status": "PAUSED",
                        "config": {
                            "id": config.id,
                            "name": config.name,
                            "template_id": config.template_id,
                            "symbols": self.repo.get_symbols(config),
                            "timeframe": config.timeframe,
                            "parameters": self.repo.get_parameters(config),
                            "mode": config.mode
                        }
                    }
                logger.info("Strategy ID %s paused successfully.", strategy_id)
                return True
            return False
        finally:
            if own_session:
                session.close()

    async def evaluate_strategy(
        self,
        strategy_id: int,
        session: Optional[Any] = None,
        force: bool = False,
    ) -> list[StrategySignalModel]:
        """Evaluates all bound symbols for a given strategy and persists any new signals."""
        own_session = False
        if session is None:
            session = self.session_factory()
            own_session = True
        try:
            config = self.repo.get_strategy_config(session, strategy_id)
            if not config:
                logger.warning("Attempted to evaluate non-existent strategy config ID %s", strategy_id)
                return []

            if not force and config.status != "RUNNING":
                logger.debug("Skipping evaluation for strategy ID %s since status is '%s'", strategy_id, config.status)
                return []

            try:
                symbols = json.loads(config.symbols)
            except Exception as exc:
                logger.error("Failed to parse symbols JSON for strategy ID %s: %s", strategy_id, exc)
                return []

            new_signals = []
            for symbol in symbols:
                try:
                    sig = await self.evaluate_symbol(config, symbol, session=session)
                    if sig:
                        new_signals.append(sig)
                except Exception as exc:
                    logger.error("Error evaluating symbol %s on strategy ID %s: %s", symbol, strategy_id, exc)

            return new_signals
        finally:
            if own_session:
                session.close()

    async def evaluate_symbol(
        self,
        strategy_config: Union[StrategyConfigModel, int],
        symbol: str,
        session: Optional[Any] = None,
        candles: Optional[list[dict]] = None,
    ) -> Optional[StrategySignalModel]:
        """
        Runs strategy rules over a symbol's candle sequence.
        
        If a new signal transition is generated at the latest candle, records it to the database.
        If mode is 'PAPER', immediately publishes a SignalEvent over the EventBus.
        """
        own_session = False
        if session is None:
            session = self.session_factory()
            own_session = True
        try:
            if isinstance(strategy_config, int):
                strategy_id = strategy_config
                strategy_config = self.repo.get_strategy_config(session, strategy_id)
                if not strategy_config:
                    logger.warning("Attempted to evaluate symbol %s on non-existent strategy config ID %s", symbol, strategy_id)
                    return None
            else:
                strategy_id = strategy_config.id

            symbol_upper = symbol.strip().upper()
            if candles is None:
                if self.candle_store:
                    candles = self.candle_store.get_candles(symbol_upper, strategy_config.timeframe)
                else:
                    candles = []

            if not candles:
                logger.warning(
                    "No candles available to evaluate strategy ID %s on symbol %s",
                    strategy_config.id,
                    symbol_upper,
                )
                return None

            last_candle_timestamp = str(candles[-1].get("time") or candles[-1].get("timestamp") or "")

            # 1. Candle duplicate check: Prevent duplicate signal generation if a signal for the same strategy_id, symbol, and source_candle_time exists
            dup_signal = session.query(StrategySignalModel).filter(
                StrategySignalModel.strategy_id == strategy_id,
                StrategySignalModel.symbol == symbol_upper,
                StrategySignalModel.source_candle_time == last_candle_timestamp
            ).first()
            if dup_signal:
                logger.debug(
                    "Signal for strategy %s, symbol %s, candle %s already recorded.",
                    strategy_id,
                    symbol_upper,
                    last_candle_timestamp
                )
                return None

            # 2. Cooldown check: Check now - last_signal.created_at < cooldown_seconds. If so, skip.
            if strategy_config.cooldown_seconds and strategy_config.cooldown_seconds > 0:
                last_sig = session.query(StrategySignalModel).filter(
                    StrategySignalModel.strategy_id == strategy_id
                ).order_by(StrategySignalModel.id.desc()).first()
                if last_sig and last_sig.created_at:
                    try:
                        cleaned_ts = last_sig.created_at.replace("Z", "+00:00")
                        last_created = datetime.fromisoformat(cleaned_ts)
                        if last_created.tzinfo is None:
                            last_created = last_created.replace(tzinfo=timezone.utc)
                        now_utc = datetime.now(timezone.utc)
                        elapsed = (now_utc - last_created).total_seconds()
                        if elapsed < strategy_config.cooldown_seconds:
                            logger.info(
                                "Skipping strategy ID %s evaluation: in cooldown. Elapsed: %s s, Cooldown: %s s",
                                strategy_id,
                                elapsed,
                                strategy_config.cooldown_seconds
                            )
                            return None
                    except Exception as e:
                        logger.error("Error checking cooldown for strategy ID %s: %s", strategy_id, e)

            # 3. Daily limit check: Count signals for the strategy where created_at starts with the current UTC date.
            if strategy_config.max_signals_per_day and strategy_config.max_signals_per_day > 0:
                today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                daily_count = session.query(StrategySignalModel).filter(
                    StrategySignalModel.strategy_id == strategy_id,
                    StrategySignalModel.created_at.like(f"{today_str}%")
                ).count()
                if daily_count >= strategy_config.max_signals_per_day:
                    logger.warning(
                        "Skipping strategy ID %s: daily limit of %s reached (current: %s)",
                        strategy_id,
                        strategy_config.max_signals_per_day,
                        daily_count
                    )
                    return None

            # Parse parameters
            try:
                params = json.loads(strategy_config.parameters) if isinstance(strategy_config.parameters, str) else strategy_config.parameters
            except Exception as exc:
                logger.error("Error parsing strategy configuration parameters for ID %s: %s", strategy_config.id, exc)
                params = {}

            # Instantiate Pydantic model needed by BacktestEngine
            pydantic_config = StrategyConfig(
                strategy_name=strategy_config.template_id,
                symbol=symbol_upper,
                timeframe=strategy_config.timeframe,
                params=params or {},
                initial_capital=100000.0,
                quantity=1,
            )

            try:
                signals = self.backtest_engine.generate_signals(pydantic_config, candles)
            except Exception as exc:
                logger.error(
                    "Failed to run strategy generator for strategy ID %s on symbol %s: %s",
                    strategy_config.id,
                    symbol_upper,
                    exc,
                )
                return None

            if not signals:
                return None

            # Check the latest signal generated
            latest_signal = signals[-1]
            
            # We only want to generate signals that match the latest candles in our series
            # to ensure they are live/current trading signals.
            signal_timestamp = str(latest_signal.timestamp)

            if signal_timestamp != last_candle_timestamp:
                logger.debug(
                    "Skipping signal for symbol %s: signal timestamp (%s) is older than latest candle (%s)",
                    symbol_upper,
                    signal_timestamp,
                    last_candle_timestamp,
                )
                return None

            # Deduplication: double check the last recorded signal for this strategy and symbol
            last_recorded = self.repo.list_strategy_signals(session, strategy_id=strategy_config.id, limit=1)
            if last_recorded:
                last_sig = last_recorded[0]
                # Skip if same candle time and same side (action)
                if last_sig.source_candle_time == signal_timestamp and last_sig.side == latest_signal.action:
                    logger.debug(
                        "Signal for strategy %s, symbol %s, candle %s and side %s already recorded.",
                        strategy_config.id,
                        symbol_upper,
                        signal_timestamp,
                        latest_signal.action,
                    )
                    return None

            # Autopilot logic: determine initial status and flow
            is_auto = bool(strategy_config.auto_paper_enabled)
            status_init = "APPROVED_PAPER" if is_auto else "GENERATED"

            # Record new signal
            signal_model = self.repo.record_strategy_signal(
                session=session,
                strategy_id=strategy_config.id,
                symbol=symbol_upper,
                side=latest_signal.action,
                confidence=latest_signal.strength,
                reason=latest_signal.reason,
                price=latest_signal.price,
                timeframe=strategy_config.timeframe,
                source_candle_time=signal_timestamp,
                status=status_init,
            )

            # Route execution if autopilot is enabled
            if is_auto:
                await self._publish_signal_event(signal_model, override_mode="PAPER")
                signal_model = self.repo.update_signal_status(session, signal_model.id, "PAPER_EXECUTED")
            elif strategy_config.mode == "PAPER":
                # For compatibility with older tests where mode is PAPER and auto_paper_enabled defaults to False
                await self._publish_signal_event(signal_model)
                signal_model = self.repo.update_signal_status(session, signal_model.id, "PAPER_EXECUTED")

            return signal_model
        finally:
            if own_session:
                session.close()

    async def approve_signal(self, signal_id: int, session: Optional[Any] = None) -> bool:
        """
        Manually approves a REVIEW_ONLY or GENERATED signal, transitions its status to APPROVED,
        and pushes it onto the EventBus for validation and routing.
        """
        own_session = False
        if session is None:
            session = self.session_factory()
            own_session = True
        try:
            signal = session.query(StrategySignalModel).filter(StrategySignalModel.id == signal_id).first()
            if not signal:
                logger.warning("Attempted to approve non-existent signal ID %s", signal_id)
                return False

            if signal.status == "APPROVED":
                logger.info("Signal ID %s is already approved.", signal_id)
                return True

            # Transition status in DB
            signal = self.repo.update_signal_status(session, signal_id, "APPROVED")
            
            # Publish to EventBus — approved signals always execute as PAPER trades
            await self._publish_signal_event(signal, override_mode="PAPER")
            return True
        finally:
            if own_session:
                session.close()

    async def _publish_signal_event(self, signal_model: StrategySignalModel, override_mode: Optional[str] = None) -> None:
        """Helper to create and publish a SignalEvent to the EventBus."""
        if not self.event_bus:
            logger.warning("EventBus is not initialized. Skipping signal event publication.")
            return

        # Fetch the strategy configuration for template information
        strategy_config = signal_model.strategy
        strategy_name = strategy_config.template_id if strategy_config else "UnknownStrategy"
        effective_mode = override_mode or (strategy_config.mode if strategy_config else None)

        event = SignalEvent(
            symbol=signal_model.symbol,
            strategy_name=strategy_name,
            action=signal_model.side,
            strength=signal_model.confidence if signal_model.confidence is not None else 1.0,
            reason=signal_model.reason or "No reason provided",
            ltp=signal_model.price,
            indicators={},  # BacktestEngine signals doesn't return full indicators dictionary
            source_tick_event_id=None,
            mode=effective_mode,
            strategy_id=strategy_config.id if strategy_config else None,
            signal_id=signal_model.id,
        )

        logger.info(
            "Emitting SignalEvent for strategy '%s', symbol %s, side %s, candle time %s",
            strategy_name,
            signal_model.symbol,
            signal_model.side,
            signal_model.source_candle_time,
        )
        await self.event_bus.publish(event)
