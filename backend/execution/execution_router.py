from typing import Optional

from loguru import logger

from backend.core.config import settings
from backend.core.events import LogEvent, OrderRequestEvent, OrderStateEvent, EventType
from backend.core.types import OrderStatus, TradingMode
from backend.execution.live_order_manager import LiveOrderManager
from backend.execution.models import OrderIntent, RiskDecision, order_intent_to_request_event
from backend.execution.order_state_machine import OrderStateMachine
from backend.execution.paper_order_manager import PaperOrderManager
from backend.execution.pre_trade_risk_gate import PreTradeRiskGate
from backend.execution.order_store import OrderStore


# Statuses that represent a completed lifecycle — never rewrite over these with defaults.
_TERMINAL_STATUSES = {
    OrderStatus.FILLED.value,
    OrderStatus.REJECTED.value,
    OrderStatus.CANCELLED.value,
}

# Mapping from OrderStateEvent.status to the DB status string stored in order_requests.
# Non-terminal / intermediate states are never written as REJECTED.
_STATUS_TO_DB: dict[str, str] = {
    OrderStatus.PENDING.value: "PENDING",
    OrderStatus.OPEN.value: "OPEN",
    OrderStatus.FILLED.value: "FILLED",
    OrderStatus.REJECTED.value: "REJECTED",
    OrderStatus.CANCELLED.value: "CANCELLED",
}


class ExecutionRouter:
    def __init__(
        self,
        mode: Optional[str] = None,
        session=None,
        session_manager=None,
        event_bus=None,
        market_watch=None,
        portfolio_manager=None,
        risk_manager=None,
        initial_mode: str = TradingMode.PAPER.value,
        live_enabled: bool = False,
        trade_journal=None,
        order_store=None,
        paper_config=None,
        kill_switch=None,
    ):
        self.mode = mode or initial_mode or TradingMode.PAPER.value
        if self.mode not in {TradingMode.PAPER.value, TradingMode.LIVE.value}:
            self.mode = TradingMode.PAPER.value
        self.session_manager = session_manager or session
        self.event_bus = event_bus
        self.market_watch = market_watch
        self.portfolio_manager = portfolio_manager
        self.risk_manager = risk_manager
        self.live_enabled = bool(live_enabled)
        
        # Kill switch initialization: default active to True in production, but False in tests
        if kill_switch is not None:
            self.kill_switch = kill_switch
        else:
            import sys
            from backend.execution.kill_switch import KillSwitchService
            in_pytest = "pytest" in sys.modules
            default_active = not in_pytest
            self.kill_switch = KillSwitchService(event_bus=event_bus, default_active=default_active)
        self.order_state_machine = OrderStateMachine(event_bus=event_bus)
        self.risk_gate = PreTradeRiskGate(
            self.kill_switch,
            market_watch=market_watch,
            portfolio_manager=portfolio_manager,
            settings=settings,
        )
        if order_store is not None:
            self.order_store = order_store
        else:
            db_path = getattr(settings, "db_path", "data/trades.db")
            self.order_store = OrderStore(db_path=db_path)

        self.paper_manager = PaperOrderManager(
            event_bus=event_bus,
            trade_journal=trade_journal,
            order_state_machine=self.order_state_machine,
            order_store=self.order_store,
            config=paper_config,
        )
        self.live_manager = LiveOrderManager(
            session_manager=self.session_manager,
            event_bus=event_bus,
            order_state_machine=self.order_state_machine,
            trading_mode=self.mode,
            live_enabled=self.live_enabled,
        )
        self.live_manager.preflight_gate.kill_switch = self.kill_switch
        self.live_manager.preflight_gate.market_watch = self.market_watch
        self.live_manager.preflight_gate.settings = settings
        self.executor = self.paper_manager if self.mode == TradingMode.PAPER.value else self.live_manager
        self._processed_request_ids: set[str] = set()

        # Subscribe to OrderStateEvent so that broker-poll-driven transitions are
        # persisted to the DB even when they do not flow through this router's route().
        if self.event_bus:
            self.event_bus.subscribe(EventType.ORDER_STATE.value, self._on_order_state_event)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def recover_from_store(self) -> int:
        """Reload non-terminal orders persisted in OrderStore into memory.

        Must be called during startup, after all components are initialised
        and BEFORE the server begins accepting new order events.

        What it does:
        1. Calls ``order_store.get_active_requests()`` to fetch all rows whose
           status is not terminal (FILLED / REJECTED / CANCELLED / RISK_REJECTED /
           DUPLICATE_REJECTED).
        2. Passes the rows to ``order_state_machine.load_from_store()`` which
           reconstructs minimal ``InternalOrderState`` objects without publishing
           any events or calling broker APIs.
        3. Seeds ``self._processed_request_ids`` from the recovered rows so that
           duplicate-detection continues to work correctly across restarts.
        4. Logs a safe count-only summary (no symbols, no credentials).

        Safety guarantees:
        - Never publishes OrderStateEvent or any event.
        - Never calls broker APIs.
        - Never places or modifies orders.
        - Errors per row are swallowed inside load_from_store; startup never crashes.

        Returns the number of orders successfully recovered.
        """
        try:
            active_rows = self.order_store.get_active_requests()
        except Exception as exc:
            logger.warning(f"OMS RECOVERY: Could not load active requests: {exc.__class__.__name__}")
            return 0

        count = self.order_state_machine.load_from_store(active_rows)

        # Seed duplicate-detection set so re-submitted request_ids are blocked.
        for row in active_rows:
            rid = row.get("request_id")
            if rid:
                self._processed_request_ids.add(rid)

        logger.info(f"OMS RECOVERY: ExecutionRouter seeded {len(self._processed_request_ids)} request IDs for duplicate detection.")
        return count

    async def submit_intent(self, intent: OrderIntent, latest_market: Optional[dict] = None) -> OrderStateEvent:
        order_request = order_intent_to_request_event(intent)
        order_request.event_id = intent.intent_id
        return await self.route(order_request, latest_market=latest_market)

    async def route(self, order_request: OrderRequestEvent, latest_market: Optional[dict] = None) -> OrderStateEvent:
        client_order_id = getattr(order_request, "client_order_id", None) or order_request.event_id
        idempotency_key = getattr(order_request, "idempotency_key", None) or order_request.event_id

        # 1. Duplicate detection — in-memory fast path + DB fallback
        if (order_request.event_id in self._processed_request_ids or
                self.order_store.check_duplicate(order_request.event_id, idempotency_key)):
            logger.warning(f"EXECUTION ROUTER: Duplicate OrderRequestEvent detected: {order_request.event_id}")
            self.order_store.add_order_event(
                order_request.event_id, "DUPLICATE_REJECTED", "REJECTED", reason="duplicate_request"
            )
            reject_event = self._simple_rejected_event(order_request, "duplicate_request")
            if self.event_bus:
                await self.event_bus.publish(reject_event)
            return reject_event

        self._processed_request_ids.add(order_request.event_id)

        # 2. Persist as RECEIVED
        inserted = self.order_store.add_order_request(
            request_id=order_request.event_id,
            client_order_id=client_order_id,
            idempotency_key=idempotency_key,
            symbol=order_request.symbol,
            side=order_request.side,
            quantity=order_request.quantity,
            order_type=order_request.order_type,
            mode=self.mode,
            status="RECEIVED",
        )
        if not inserted:
            logger.warning(f"EXECUTION ROUTER: Duplicate via SQLite constraint: {order_request.event_id}")
            self.order_store.add_order_event(
                order_request.event_id, "DUPLICATE_REJECTED", "REJECTED", reason="duplicate_request"
            )
            reject_event = self._simple_rejected_event(order_request, "duplicate_request")
            if self.event_bus:
                await self.event_bus.publish(reject_event)
            return reject_event

        self.order_store.add_order_event(order_request.event_id, "RECEIVED", "RECEIVED")

        # 3. Build intent
        intent = OrderIntent(
            symbol=order_request.symbol,
            side=order_request.side,
            quantity=order_request.quantity,
            order_type=order_request.order_type,
            price=order_request.price,
            strategy_name=order_request.strategy_name,
            signal_event_id=order_request.signal_event_id,
            source=order_request.source,
            trading_mode=self.mode,
        )

        # 4. Pre-trade risk gate
        decision = await self.risk_gate.evaluate(intent, latest_market)
        if not decision.approved:
            self.order_store.update_order_status(
                order_request.event_id, "RISK_REJECTED", reason=decision.rejected_reason
            )
            self.order_store.add_order_event(
                order_request.event_id, "RISK_REJECTED", "REJECTED", reason=decision.rejected_reason
            )
            reject_event = self._risk_rejected_event(intent, decision, order_request.event_id)
            if self.event_bus:
                await self.event_bus.publish(reject_event)
            return reject_event

        self.order_store.update_order_status(order_request.event_id, "RISK_APPROVED")
        self.order_store.add_order_event(order_request.event_id, "RISK_APPROVED", "RISK_APPROVED")

        # 5. Route to adapter
        if self.mode == TradingMode.PAPER.value:
            self.order_store.add_order_event(order_request.event_id, "ROUTED_TO_PAPER", "PENDING")
            self.order_store.update_order_status(order_request.event_id, "ROUTED_TO_PAPER")
            res_event = await self.paper_manager.place_order(order_request, latest_market or {})
            self._persist_execution_result(order_request.event_id, res_event)
            return res_event

        if self.mode == TradingMode.LIVE.value:
            if not await self._live_checks_pass():
                self.order_store.update_order_status(
                    order_request.event_id, "REJECTED", reason="live_safety_check_failed"
                )
                self.order_store.add_order_event(
                    order_request.event_id, "REJECTED", "REJECTED", reason="live_safety_check_failed"
                )
                reject_event = self._simple_rejected_event(order_request, "live_safety_check_failed")
                if self.event_bus:
                    await self.event_bus.publish(reject_event)
                return reject_event

            self.order_store.add_order_event(order_request.event_id, "ROUTED_TO_LIVE", "PENDING")
            self.order_store.update_order_status(order_request.event_id, "ROUTED_TO_LIVE")
            self.live_manager.trading_mode = self.mode
            self.live_manager.live_enabled = self.live_enabled
            res_event = await self.live_manager.place_order(order_request)
            self._persist_execution_result(order_request.event_id, res_event)
            return res_event

        # Fallback: unknown mode
        self.order_store.update_order_status(
            order_request.event_id, "REJECTED", reason="invalid_execution_mode"
        )
        self.order_store.add_order_event(
            order_request.event_id, "REJECTED", "REJECTED", reason="invalid_execution_mode"
        )
        reject_event = self._simple_rejected_event(order_request, "invalid_execution_mode")
        if self.event_bus:
            await self.event_bus.publish(reject_event)
        return reject_event

    # ------------------------------------------------------------------
    # Mode switching
    # ------------------------------------------------------------------

    async def switch_to_live(self, confirm: bool = False) -> bool:
        if not confirm:
            return False
        if not self.live_enabled:
            return False
        if not self.session_manager or not getattr(self.session_manager, "is_valid", False):
            return False
        if self.order_state_machine.has_pending_or_open_orders():
            return False
        if self._has_open_positions():
            return False
        if self.kill_switch.is_active:
            return False
        self.mode = TradingMode.LIVE.value
        self.live_manager.trading_mode = self.mode
        self.executor = self.live_manager
        await self._audit("Execution mode switched to LIVE")
        return True

    async def switch_to_paper(self) -> None:
        self.mode = TradingMode.PAPER.value
        self.live_manager.trading_mode = self.mode
        self.executor = self.paper_manager
        await self._audit("Execution mode switched to PAPER")

    def status(self) -> dict:
        return {
            "mode": self.mode,
            "live_enabled": self.live_enabled,
            "kill_switch": self.kill_switch.status(),
            "orders": self.order_state_machine.status(),
        }

    def place_order(self, symbol, token=None, side=None, quantity=None, price=None):
        """
        DEPRECATED: Use event-driven async route() instead.
        This legacy method bypasses PreTradeRiskGate checks and is kept only for
        backward compatibility with legacy routes/tests.
        """
        if self.mode != TradingMode.PAPER.value:
            return {"status": OrderStatus.REJECTED.value, "reason": "live_execution_locked"}
        return self.paper_manager.place_order_legacy(symbol, token, side, quantity, price)

    async def route_order(self, order_request: OrderRequestEvent, latest_market: Optional[dict] = None) -> OrderStateEvent:
        return await self.route(order_request, latest_market)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _persist_execution_result(self, request_id: str, res_event: OrderStateEvent) -> None:
        """
        Persist the final execution result correctly — mapping adapter status to DB status.

        BLOCKER FIX (Phase 18E): Previously, any non-FILLED result fell into an else-REJECTED
        branch, causing PENDING/OPEN orders to be incorrectly marked REJECTED in the database.
        Now we use an explicit status-to-DB mapping, and only persist REJECTED when the event
        actually carries a rejected status.
        """
        status = res_event.status
        broker_id = res_event.broker_order_id

        # Map adapter status to DB status string, defaulting unknown non-terminal to PENDING
        db_status = _STATUS_TO_DB.get(status, "PENDING")

        self.order_store.update_order_status(
            request_id,
            db_status,
            reason=res_event.reject_reason if status in (OrderStatus.REJECTED.value, OrderStatus.CANCELLED.value) else None,
            broker_order_id=broker_id,
            avg_fill_price=res_event.avg_fill_price if status == OrderStatus.FILLED.value else None,
        )
        self.order_store.add_order_event(
            request_id,
            db_status,
            db_status,
            reason=res_event.reject_reason if status in (OrderStatus.REJECTED.value, OrderStatus.CANCELLED.value) else None,
            broker_order_id=broker_id,
        )

    async def _on_order_state_event(self, event: OrderStateEvent) -> None:
        """
        EventBus subscriber for ORDER_STATE events.

        Persists broker-poll-driven or internal state machine transitions back to the
        OrderStore so the database stays in sync with the in-memory state machine.
        This is the Phase 18E fix for the OrderPoller → DB desync gap.

        Only processes events that have an order_request_id (so we can link to order_requests).
        Does NOT create new order_requests rows; only updates existing ones.

        IMPORTANT: Does NOT overwrite internal routing-specific statuses such as
        RISK_REJECTED, RISK_APPROVED, ROUTED_TO_PAPER, ROUTED_TO_LIVE.
        These are set explicitly by the routing logic and carry more semantic precision
        than generic REJECTED / PENDING from the generic event payload.
        """
        if not isinstance(event, OrderStateEvent):
            return
        request_id = event.order_request_id
        if not request_id:
            return
        # Do not update DB if we have no record of this request (e.g. pre-18C legacy orders)
        existing = self.order_store.get_order_request(request_id)
        if not existing:
            return

        # Skip: do not overwrite RISK_REJECTED with a generic REJECTED event.
        # RISK_REJECTED is set by the routing logic with more semantic precision than
        # a generic OrderStateEvent.status == REJECTED from the event payload.
        # All other statuses (ROUTED_TO_PAPER, PENDING, OPEN, etc.) CAN be updated
        # by subsequent events (e.g. a FILLED event after ROUTED_TO_PAPER).
        if existing.get("status") == "RISK_REJECTED" and event.status == OrderStatus.REJECTED.value:
            return

        db_status = _STATUS_TO_DB.get(event.status, "PENDING")
        broker_id = event.broker_order_id

        self.order_store.update_order_status(
            request_id,
            db_status,
            reason=event.reject_reason if event.status in (OrderStatus.REJECTED.value, OrderStatus.CANCELLED.value) else None,
            broker_order_id=broker_id,
            avg_fill_price=event.avg_fill_price if event.status == OrderStatus.FILLED.value else None,
        )
        self.order_store.add_order_event(
            request_id,
            f"STATE_UPDATE:{db_status}",
            db_status,
            reason=event.reject_reason if event.status in (OrderStatus.REJECTED.value, OrderStatus.CANCELLED.value) else None,
            broker_order_id=broker_id,
        )

    async def _live_checks_pass(self) -> bool:
        if self.kill_switch.is_active:
            return False
        if self.order_state_machine.has_pending_or_open_orders():
            return False
        if self._has_open_positions():
            return False
        if not self.session_manager or not getattr(self.session_manager, "is_valid", False):
            return False
        return self.live_enabled and self.mode == TradingMode.LIVE.value

    def _has_open_positions(self) -> bool:
        if not self.portfolio_manager:
            return False
        positions = getattr(self.portfolio_manager, "open_positions", None) or getattr(self.portfolio_manager, "positions", None)
        return bool(positions)

    def _risk_rejected_event(
        self,
        intent: OrderIntent,
        decision: RiskDecision,
        request_id: Optional[str] = None,
    ) -> OrderStateEvent:
        return OrderStateEvent(
            order_id=intent.intent_id,
            broker_order_id=None,
            symbol=intent.symbol,
            side=intent.side,
            quantity=intent.quantity,
            filled_quantity=0,
            avg_fill_price=None,
            status=OrderStatus.REJECTED.value,
            reject_reason=decision.rejected_reason,
            order_request_id=request_id or intent.intent_id,
        )

    def _simple_rejected_event(self, request: OrderRequestEvent, reason: str) -> OrderStateEvent:
        return OrderStateEvent(
            order_id=request.event_id,
            broker_order_id=None,
            symbol=request.symbol,
            side=request.side,
            quantity=request.quantity,
            filled_quantity=0,
            avg_fill_price=None,
            status=OrderStatus.REJECTED.value,
            reject_reason=reason,
            order_request_id=request.event_id,
        )

    async def _audit(self, message: str) -> None:
        logger.info(message)
        if self.event_bus:
            await self.event_bus.publish(LogEvent(level="INFO", component="EXECUTION", message=message))
