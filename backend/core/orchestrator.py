# backend/core/orchestrator.py

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from backend.candles.candle_fetcher import CandleFetcher
from backend.core.config import settings
from backend.core.events import EventType, TickEvent, event_to_dict, SignalEvent, OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderStatus
from backend.gateway.market_gateway import MarketDataGateway
from backend.gateway.tick_bus import TickBus
from backend.core.session_manager import SessionManager
from backend.gateway import instrument_registry
from backend.portfolio.rebuild import rebuild_portfolio_from_fills
from backend.strategy.signal_validator import SignalValidator
from backend.observability.metrics_store import start_sampler

logger = logging.getLogger(__name__)


def safe_error_message(error: Exception) -> str:
    message = str(error) or error.__class__.__name__
    sensitive_terms = ("api_key", "password", "secret", "jwt", "refresh", "feed", "token")
    if any(term in message.lower() for term in sensitive_terms):
        return error.__class__.__name__
    return message


def parse_event_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


class SystemOrchestrator:
    """Coordinates lifecycle events, background event loops, and ticks.
    
    This class refactors background operational complexities away from api_server.py
    while remaining fully compatible with the existing global state patterns.
    """

    def __init__(
        self,
        broadcaster: Any,
        event_bus: Any,
        candle_store: Any,
        indicator_engine: Any,
        backtest_engine: Any,
        market_watch: Any,
        portfolio: Any,
        risk: Any,
        strategy: Any,
        portfolio_engine: Any,
        router: Any,
        instrument_loader: Any,
        market_board: Any,
        screener_engine: Any,
        obs_metrics: Any,
        obs_event_log: Any,
        obs_timeline: Any,
        execution_mode: str = "PAPER",
        on_state_update: Optional[Callable[[str, Any], None]] = None,
        get_auto_pilot: Optional[Callable[[], bool]] = None,
        get_trade_cooldown: Optional[Callable[[], float]] = None,
        get_last_trade_time: Optional[Callable[[], float]] = None,
        get_execution_mode: Optional[Callable[[], str]] = None,
    ):
        self.broadcaster = broadcaster
        self.event_bus = event_bus
        self.candle_store = candle_store
        self.indicator_engine = indicator_engine
        self.backtest_engine = backtest_engine
        self.market_watch = market_watch
        self.portfolio = portfolio
        self.risk = risk
        self.strategy = strategy
        self.portfolio_engine = portfolio_engine
        self.router = router
        self.instrument_loader = instrument_loader
        self.market_board = market_board
        self.screener_engine = screener_engine
        self.obs_metrics = obs_metrics
        self.obs_event_log = obs_event_log
        self.obs_timeline = obs_timeline
        self.on_state_update = on_state_update

        self._get_auto_pilot = get_auto_pilot
        self._get_trade_cooldown = get_trade_cooldown
        self._get_last_trade_time = get_last_trade_time
        self._get_execution_mode = get_execution_mode

        self._execution_mode = execution_mode
        self._auto_pilot = False
        self._last_trade_time = 0.0
        self._trade_cooldown = 60.0

        # Managed background tasks & broker gateways
        self.gateway = None
        self.tick_bus = None
        self.session_manager = None
        self.tick_consumer_task = None
        self.sampler_task = None
        self.candle_fetcher = None

        # Status track variables
        self.broker_status = {
            "configured": True,
            "logged_in": False,
            "feed_token_available": False,
            "websocket_started": False,
            "last_error": None,
        }
        self.instrument_master_status = {
            "loaded": len(instrument_registry.load_instruments()),
            "source": "fallback",
            "cached_at": None,
            "cache_fresh": False,
            "fallback_active": True,
        }

        # Initialize Signal Validator
        self.signal_validator = SignalValidator(
            event_bus=self.event_bus,
            kill_switch=self.router.kill_switch,
            live_trading_enabled=settings.live_trading_enabled,
            default_quantity=1,
        )

        # Initialize Strategy Runtime Manager
        from backend.core.database import create_engine_safe, get_session_factory, init_db_metadata
        self._db_engine = create_engine_safe()
        init_db_metadata(self._db_engine)
        self.session_factory = get_session_factory(self._db_engine)

        from backend.strategy.runtime import StrategyRuntimeManager
        self.strategy_runtime_manager = StrategyRuntimeManager(
            session_factory=self.session_factory,
            event_bus=self.event_bus,
            candle_store=self.candle_store,
            indicator_engine=self.indicator_engine,
            backtest_engine=self.backtest_engine,
        )

        from backend.strategy.scheduler import StrategyScheduler
        self.strategy_scheduler = StrategyScheduler(
            session_factory=self.session_factory,
            runtime_manager=self.strategy_runtime_manager,
        )

        self._setup_event_subscriptions()

    def _update_state(self, name: str, value: Any):
        """Sets internal value and invokes the state sync callback if configured."""
        setattr(self, name, value)
        if self.on_state_update:
            try:
                self.on_state_update(name, value)
            except Exception as e:
                logger.error(f"Error executing state update callback for {name}: {e}")

    def _setup_event_subscriptions(self):
        """Binds subscribers to the event bus."""
        self.event_bus.subscribe(EventType.TICK.value, self.candle_store.on_tick_event)
        self.event_bus.subscribe(EventType.ORDER_STATE.value, self.portfolio_engine.on_order_state_event)
        self.event_bus.subscribe(EventType.ORDER_STATE.value, self.on_order_state_event_legacy_updater)
        self.event_bus.subscribe(EventType.SIGNAL.value, self.on_signal_event)
        self.event_bus.subscribe(EventType.ORDER_REQUEST.value, self.on_order_request_event)
        self.event_bus.subscribe("*", self.observability_event_recorder)
        self.event_bus.subscribe(EventType.GATEWAY_STATUS.value, self.gateway_status_to_timeline)
        self.event_bus.subscribe(EventType.SESSION.value, self.session_to_timeline)

        for bridged_type in (
            EventType.SIGNAL.value,
            EventType.PORTFOLIO.value,
            EventType.GATEWAY_STATUS.value,
            EventType.SESSION.value,
            EventType.ERROR.value,
        ):
            self.event_bus.subscribe(bridged_type, self.event_to_ws_bridge)

    def utc_timestamp(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    async def websocket_broadcast(self, message: dict):
        await self.broadcaster.broadcast(message)

    async def event_to_ws_bridge(self, event: Any):
        event_type = getattr(event, "event_type", "unknown")
        type_str = event_type.lower() if isinstance(event_type, str) else str(event_type).lower()
        await self.websocket_broadcast({
            "type": type_str,
            "payload": event_to_dict(event),
            "ts": self.utc_timestamp(),
        })

    async def observability_event_recorder(self, event: Any):
        self.obs_event_log.record(event)

    async def gateway_status_to_timeline(self, event: Any):
        self.obs_timeline.record_state_change(
            "gateway",
            getattr(event, "status", None) or getattr(event, "connection_state", None) or "UNKNOWN",
            getattr(event, "detail", "") or "",
        )

    async def session_to_timeline(self, event: Any):
        self.obs_timeline.record_state_change(
            "session",
            getattr(event, "status", None) or "UNKNOWN",
            getattr(event, "detail", "") or "",
        )

    async def on_signal_event(self, event: SignalEvent):
        """Handles routing of signals (both manual and auto-pilot)."""
        is_manual = False
        allowed = self.auto_pilot
        
        signal_id = getattr(event, "signal_id", None)
        if signal_id is not None:
            from backend.db.models import StrategySignalModel
            session = self.session_factory()
            try:
                sig = session.query(StrategySignalModel).filter(StrategySignalModel.id == signal_id).first()
                if sig:
                    strategy_auto = bool(sig.strategy and sig.strategy.auto_paper_enabled)
                    if sig.status == "APPROVED":
                        is_manual = not strategy_auto
                        allowed = True
                    elif sig.status == "APPROVED_PAPER":
                        is_manual = not strategy_auto
                        allowed = True
                    elif strategy_auto and sig.status in ("GENERATED", "VALIDATED"):
                        allowed = True
            except Exception as e:
                logger.error(f"Error checking signal routing allowance: {e}")
            finally:
                session.close()

        if not allowed:
            return

        # Check global trade cooldown ONLY for automated (non-manual) signals
        now = asyncio.get_event_loop().time()
        if not is_manual:
            if now - self.last_trade_time <= self.trade_cooldown:
                logger.debug(f"AUTOPILOT: Global cooldown active, skipping signal for {event.symbol}")
                return

        # Route via SignalValidator
        order_request = await self.signal_validator.validate_and_route(event, trading_mode=self.execution_mode)
        if order_request is None:
            if signal_id is not None:
                self._update_strategy_signal_status(
                    signal_id,
                    "REJECTED",
                    getattr(self.signal_validator, "last_rejection_reason", None) or "signal_validation_failed",
                )
            return
        if order_request and not is_manual:
            self._update_state("last_trade_time", now)

    async def on_order_request_event(self, event: OrderRequestEvent):
        """Routes validated order requests to execution."""
        result = await self.router.route(event)
        self._update_strategy_signal_from_order_result(event, result)

    def _update_strategy_signal_from_order_result(self, request: OrderRequestEvent, result: OrderStateEvent) -> None:
        """Persist strategy signal execution status from the actual order result."""
        signal_id = getattr(request, "strategy_signal_id", None)
        if signal_id is None:
            return

        if result.status == OrderStatus.FILLED.value:
            self._update_strategy_signal_status(signal_id, "PAPER_EXECUTED")
        elif result.status == OrderStatus.REJECTED.value:
            self._update_strategy_signal_status(
                signal_id,
                "REJECTED",
                result.reject_reason or "paper_order_rejected",
            )
        elif result.status == OrderStatus.CANCELLED.value:
            self._update_strategy_signal_status(
                signal_id,
                "PAPER_FAILED",
                result.reject_reason or "paper_order_cancelled",
            )
        elif result.status in {OrderStatus.OPEN.value, OrderStatus.PENDING.value}:
            self._update_strategy_signal_status(
                signal_id,
                "PAPER_PENDING",
                result.reject_reason,
            )
        else:
            self._update_strategy_signal_status(
                signal_id,
                "PAPER_FAILED",
                result.reject_reason or f"unexpected_order_status:{result.status}",
            )

    def _update_strategy_signal_status(
        self,
        signal_id: int,
        status: str,
        reason: Optional[str] = None,
    ) -> None:
        """Update strategy signal status with a safe optional error/reject reason."""
        from backend.db.models import StrategySignalModel

        session = self.session_factory()
        try:
            signal = session.query(StrategySignalModel).filter(StrategySignalModel.id == signal_id).first()
            if not signal:
                return
            if signal.status in {"DISMISSED"}:
                return
            signal.status = status
            if reason:
                signal.dismiss_reason = str(reason)[:500]
            session.commit()
        except Exception as exc:
            logger.error("Error updating signal %s execution status: %s", signal_id, exc.__class__.__name__)
        finally:
            session.close()

    async def on_order_state_event_legacy_updater(self, event: OrderStateEvent):
        """Asynchronously updates legacy portfolio and risk on fills."""
        if event.status == OrderStatus.FILLED.value:
            self.portfolio.open_position(event.symbol, event.side, event.quantity, event.avg_fill_price)
            self.risk.open_position(event.symbol, event.side, event.quantity, event.avg_fill_price)
            logger.info(f"ORDER STATE UPDATER: Position opened/updated asynchronously for {event.symbol} {event.side} @ {event.avg_fill_price}")

    def get_broker_status(self) -> Dict[str, Any]:
        if self.gateway:
            gateway_status = self.gateway.status()
            self.broker_status.update({
                "logged_in": bool(self.session_manager and self.session_manager.is_valid),
                "feed_token_available": bool(self.session_manager and self.session_manager.feed_token),
                "websocket_started": gateway_status["connection_state"] in ["CONNECTING", "CONNECTED", "RECONNECTING"],
                "last_error": gateway_status.get("last_error") or (self.session_manager.last_error if self.session_manager else None),
                "gateway": gateway_status,
            })
        elif self.session_manager:
            self.broker_status.update({
                "logged_in": self.session_manager.is_valid,
                "feed_token_available": bool(self.session_manager.feed_token),
                "last_error": self.session_manager.last_error,
            })
        return self.broker_status.copy()

    async def start_gateway(self, loop) -> bool:
        """Create and start broker connectivity without crashing the app."""
        try:
            if self.session_manager is None:
                self._update_state("session_manager", SessionManager())

            if self.candle_fetcher is None:
                self._update_state(
                    "candle_fetcher",
                    CandleFetcher(
                        session_manager=self.session_manager,
                        candle_store=self.candle_store,
                        registry=instrument_registry,
                    )
                )

            initialized = await self.session_manager.initialize()
            if not initialized:
                self.broker_status.update({
                    "logged_in": False,
                    "feed_token_available": False,
                    "websocket_started": False,
                    "last_error": self.session_manager.last_error,
                })
                # Trigger callback sync
                self._update_state("broker_status", self.broker_status)
                return False

            if self.tick_bus is None:
                self._update_state("tick_bus", TickBus())

            if self.gateway is None:
                mw_gateway = MarketDataGateway(session_manager=self.session_manager, tick_bus=self.tick_bus, loop=loop)
                mw_gateway.set_event_bus(self.event_bus)
                self._update_state("gateway", mw_gateway)

            if self.tick_consumer_task is None or self.tick_consumer_task.done():
                self._update_state("tick_consumer_task", asyncio.create_task(self.consume_tick_bus()))

            started = await self.gateway.start(self.market_watch.symbols)
            self.get_broker_status()
            self._update_state("broker_status", self.broker_status)
            return started
        except Exception as e:
            self.broker_status.update({
                "logged_in": False,
                "feed_token_available": False,
                "websocket_started": False,
                "last_error": safe_error_message(e),
            })
            self._update_state("broker_status", self.broker_status)
            logger.error("MDG: Gateway startup failed: %s", self.broker_status["last_error"])  # SECURITY: redacted
            return False

    async def start_gateway_background(self, loop):
        await self.start_gateway(loop)

    def get_instrument_cache_timestamp(self) -> Optional[str]:
        try:
            if not self.instrument_loader.meta_path.exists():
                return None
            meta = json.loads(self.instrument_loader.meta_path.read_text(encoding="utf-8"))
            cached_at = meta.get("cached_at")
            return str(cached_at) if cached_at else None
        except (OSError, json.JSONDecodeError):
            return None

    async def load_instrument_master_best_effort(self):
        source = "fallback"
        try:
            master_instruments = await asyncio.wait_for(self.instrument_loader.load(), timeout=12)
            if master_instruments:
                loaded = instrument_registry.load_from_master(master_instruments)
                if loaded:
                    source = getattr(self.instrument_loader, "_last_source", "cache")
            status = instrument_registry.registry_status()
            instrument_registry.set_master_source(source if status["loaded"] > 0 else "fallback")
            self._update_state(
                "instrument_master_status",
                {
                    "loaded": status["loaded"],
                    "source": source if not status["fallback_active"] else "fallback",
                    "cached_at": self.get_instrument_cache_timestamp(),
                    "cache_fresh": self.instrument_loader.cache_is_fresh(),
                    "fallback_active": status["fallback_active"],
                }
            )
            logger.info(
                "Instrument master loaded: %s symbols from %s",
                self.instrument_master_status["loaded"],
                self.instrument_master_status["source"],
            )
        except Exception as e:
            status = instrument_registry.registry_status()
            self._update_state(
                "instrument_master_status",
                {
                    "loaded": status["loaded"],
                    "source": "fallback",
                    "cached_at": self.get_instrument_cache_timestamp(),
                    "cache_fresh": self.instrument_loader.cache_is_fresh(),
                    "fallback_active": True,
                }
            )
            logger.warning("Instrument master load failed: %s; using fallback symbols", e.__class__.__name__)

    async def consume_tick_bus(self):
        consecutive_errors = 0
        while True:
            try:
                # Wait for next tick with timeout to allow clean shutdown/idle checks
                tick = await asyncio.wait_for(self.tick_bus.get(), timeout=5.0)
                consecutive_errors = 0  # Reset on successful retrieval
                
                if tick.get("event_type") != "tick":
                    continue

                try:
                    self.market_watch.update_tick(tick)

                    tick_event = TickEvent(
                        symbol=tick.get("symbol") or "",
                        token=tick.get("token"),
                        exchange=tick.get("exchange") or "NSE",
                        ltp=tick.get("ltp"),
                        best_bid=tick.get("best_bid"),
                        best_ask=tick.get("best_ask"),
                        bid_qty=tick.get("bid_qty"),
                        ask_qty=tick.get("ask_qty"),
                        spread=tick.get("spread"),
                        vwap=tick.get("vwap"),
                        volume=tick.get("volume"),
                        ltq=tick.get("ltq"),
                        exchange_timestamp=tick.get("exchange_timestamp") or tick.get("timestamp"),
                        received_at=parse_event_datetime(tick.get("received_at")),
                    )
                    await self.event_bus.publish(tick_event)

                    symbol = tick.get("symbol")
                    ltp = tick.get("ltp")
                    if not symbol or ltp is None:
                        continue

                    strategy_tick = tick.copy()
                    strategy_tick["price"] = ltp
                    strategy_tick["event_id"] = tick_event.event_id
                    await self.process_tick(strategy_tick)
                except Exception as e:
                    # Log type only to avoid sensitive data leak from str(e)
                    logger.error(
                        "Tick processing error: %s — tick dropped, pipeline continues",
                        type(e).__name__
                    )
            except asyncio.TimeoutError:
                continue  # No tick available, loop again
            except asyncio.CancelledError:
                logger.info("TickBus consumer shutting down")
                break
            except Exception as e:
                consecutive_errors += 1
                logger.error("TickBus error #%d: %s", consecutive_errors, type(e).__name__)
                if consecutive_errors > 50:
                    logger.critical("50 consecutive TickBus errors — investigate immediately")
                    consecutive_errors = 0  # Reset counter, keep running
                await asyncio.sleep(0.1)  # Brief pause on repeated errors

    async def process_tick(self, tick: dict):
        """Processes a live market tick: Updates strategy, risk, and portfolio."""
        symbol = tick["symbol"]
        price = tick["price"]
        vwap = tick.get("vwap")

        # Update Strategy with VWAP
        # Generate SignalEvent and publish to EventBus
        signal_event = self.strategy.generate_signal(symbol, price, vwap, tick_event_id=tick.get("event_id"))
        signal = signal_event.action
        await self.event_bus.publish(signal_event)
        
        # Update Portfolio Unrealized PnL
        self.portfolio.update_unrealized(symbol, price)
        await self.portfolio_engine.on_tick(symbol, price)
        
        # Enrichment
        tick.update({
            "signal": signal,
            "portfolio": self.portfolio.get_performance(),
            "mode": self.execution_mode,
            "auto_pilot": self.auto_pilot
        })
        
        # Broadcast to all terminal clients
        await self.websocket_broadcast({
            "type": "tick",
            "payload": tick,
            "ts": self.utc_timestamp(),
        })

    async def startup(self, fastapi_app_state: Any):
        """Initializes all backend components on server startup."""
        loop = asyncio.get_running_loop()
        
        # Start Broadcaster Service
        self.broadcaster.start(loop)
        if self.sampler_task is None or self.sampler_task.done():
            self._update_state(
                "sampler_task",
                asyncio.create_task(
                    start_sampler(self.obs_metrics, fastapi_app_state, interval_seconds=60)
                )
            )

        asyncio.create_task(self.load_instrument_master_best_effort())

        # ---- OMS Startup Recovery ----
        try:
            recovered = self.router.recover_from_store()
            logger.info(f"OMS RECOVERY: startup recovered {recovered} active order(s).")
        except Exception as _recovery_exc:
            logger.warning(f"OMS RECOVERY: startup recovery failed safely: {_recovery_exc.__class__.__name__}")

        # ---- Portfolio Rebuild from Persisted Fills ----
        try:
            _rebuild_summary = rebuild_portfolio_from_fills(
                order_store=self.router.order_store,
                portfolio_engine=self.portfolio_engine,
            )
            logger.info(
                f"PORTFOLIO REBUILD: {_rebuild_summary.total_fills_processed} fill(s) processed, "
                f"{_rebuild_summary.skipped_rows} skipped."
            )
            if _rebuild_summary.warnings:
                for _w in _rebuild_summary.warnings:
                    logger.warning(f"PORTFOLIO REBUILD: {_w}")
        except Exception as _rebuild_exc:
            logger.warning(
                f"PORTFOLIO REBUILD: startup rebuild failed safely: {_rebuild_exc.__class__.__name__}"
            )

        # Start broker connectivity separately in background
        asyncio.create_task(self.start_gateway_background(loop))

        # Start strategy runtime background loop
        if self.strategy_runtime_manager:
            await self.strategy_runtime_manager.start_background_loop()

        # Start strategy scheduler background loop if enabled
        if self.strategy_scheduler and settings.strategy_scheduler_enabled:
            await self.strategy_scheduler.start()

        if settings.demo_mode:
            logger.info("DEMO MODE enabled")

        logger.info(f"TERMINAL: Backend operational in {self.execution_mode} mode")

    async def shutdown(self):
        if self.strategy_scheduler:
            await self.strategy_scheduler.stop()
        if self.strategy_runtime_manager:
            await self.strategy_runtime_manager.stop_background_loop()
        if self.sampler_task and not self.sampler_task.done():
            self.sampler_task.cancel()
            try:
                await self.sampler_task
            except asyncio.CancelledError:
                pass

    @property
    def auto_pilot(self) -> bool:
        if self._get_auto_pilot:
            return self._get_auto_pilot()
        return self._auto_pilot

    @auto_pilot.setter
    def auto_pilot(self, value: bool):
        self._auto_pilot = value
        self._update_state("auto_pilot", value)

    @property
    def trade_cooldown(self) -> float:
        if self._get_trade_cooldown:
            return self._get_trade_cooldown()
        return self._trade_cooldown

    @trade_cooldown.setter
    def trade_cooldown(self, value: float):
        self._trade_cooldown = value
        self._update_state("trade_cooldown", value)

    @property
    def last_trade_time(self) -> float:
        if self._get_last_trade_time:
            return self._get_last_trade_time()
        return self._last_trade_time

    @last_trade_time.setter
    def last_trade_time(self, value: float):
        self._last_trade_time = value
        self._update_state("last_trade_time", value)

    @property
    def execution_mode(self) -> str:
        if self._get_execution_mode:
            return self._get_execution_mode()
        return self._execution_mode

    @execution_mode.setter
    def execution_mode(self, value: str):
        self._execution_mode = value
        self._update_state("execution_mode", value)
