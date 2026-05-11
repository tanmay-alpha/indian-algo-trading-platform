from typing import Optional

from loguru import logger

from backend.core.config import settings
from backend.core.events import LogEvent, OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderStatus, TradingMode
from backend.execution.kill_switch import KillSwitch
from backend.execution.live_order_manager import LiveOrderManager
from backend.execution.models import OrderIntent, RiskDecision, order_intent_to_request_event
from backend.execution.order_state_machine import OrderStateMachine
from backend.execution.paper_order_manager import PaperOrderManager
from backend.execution.pre_trade_risk_gate import PreTradeRiskGate


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
        self.kill_switch = KillSwitch(event_bus=event_bus)
        self.order_state_machine = OrderStateMachine(event_bus=event_bus)
        self.risk_gate = PreTradeRiskGate(
            self.kill_switch,
            market_watch=market_watch,
            portfolio_manager=portfolio_manager,
            settings=settings,
        )
        self.paper_manager = PaperOrderManager(
            event_bus=event_bus,
            trade_journal=trade_journal,
            order_state_machine=self.order_state_machine,
        )
        self.live_manager = LiveOrderManager(
            session_manager=self.session_manager,
            event_bus=event_bus,
            order_state_machine=self.order_state_machine,
            trading_mode=self.mode,
            live_enabled=self.live_enabled,
        )
        self.executor = self.paper_manager if self.mode == TradingMode.PAPER.value else self.live_manager

    async def submit_intent(self, intent: OrderIntent, latest_market: Optional[dict] = None) -> OrderStateEvent:
        decision = await self.risk_gate.evaluate(intent, latest_market)
        if not decision.approved:
            return self._risk_rejected_event(intent, decision)
        return await self.route(order_intent_to_request_event(intent), latest_market=latest_market)

    async def route(self, order_request: OrderRequestEvent, latest_market: Optional[dict] = None) -> OrderStateEvent:
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
        decision = await self.risk_gate.evaluate(intent, latest_market)
        if not decision.approved:
            return self._risk_rejected_event(intent, decision, order_request.event_id)
        if self.mode == TradingMode.PAPER.value:
            return await self.paper_manager.place_order(order_request, latest_market or {})
        if self.mode == TradingMode.LIVE.value:
            if not await self._live_checks_pass():
                return self._simple_rejected_event(order_request, "live_safety_check_failed")
            self.live_manager.trading_mode = self.mode
            self.live_manager.live_enabled = self.live_enabled
            return await self.live_manager.place_order(order_request)
        return self._simple_rejected_event(order_request, "invalid_execution_mode")

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
        if self.mode != TradingMode.PAPER.value:
            return {"status": OrderStatus.REJECTED.value, "reason": "live_execution_locked"}
        return self.paper_manager.place_order_legacy(symbol, token, side, quantity, price)

    async def route_order(self, order_request: OrderRequestEvent, latest_market: Optional[dict] = None) -> OrderStateEvent:
        return await self.route(order_request, latest_market)

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
