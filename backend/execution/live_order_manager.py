import asyncio
from typing import Optional

from loguru import logger

from backend.core.events import OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.execution.order_state_machine import OrderStateMachine


class LiveOrderManager:
    def __init__(
        self,
        session_manager=None,
        event_bus=None,
        order_state_machine: Optional[OrderStateMachine] = None,
        trading_mode: str = TradingMode.PAPER.value,
        risk_approval_checker=None,
        live_enabled: bool = False,
    ):
        self.session_manager = session_manager
        self.event_bus = event_bus
        self.order_state_machine = order_state_machine or OrderStateMachine(event_bus=event_bus)
        self.trading_mode = trading_mode
        self.risk_approval_checker = risk_approval_checker
        self.live_enabled = live_enabled

    async def place_order(self, order_request: OrderRequestEvent, ltp: Optional[float] = None) -> OrderStateEvent:
        rejection = self._safety_rejection(order_request)
        if rejection:
            return self._rejected_event(order_request, rejection)

        state = self.order_state_machine.create_order(order_request, TradingMode.LIVE.value)
        params = self._build_angel_params(order_request)
        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, self._smart_api().placeOrder, params)
            broker_order_id = self._extract_order_id(response)
            return self.order_state_machine.transition(
                state.order_id,
                OrderStatus.PENDING.value,
                broker_order_id=broker_order_id,
            )
        except Exception as exc:
            logger.error(f"Live order placement failed: {exc.__class__.__name__}")
            return self.order_state_machine.transition(
                state.order_id,
                OrderStatus.REJECTED.value,
                reject_reason="broker_order_error",
            )

    def place_order_legacy(self, symbol, token, side, quantity, price=None):
        return {"status": OrderStatus.REJECTED.value, "reason": "live_execution_locked"}

    def _safety_rejection(self, order_request: OrderRequestEvent) -> Optional[str]:
        if not self.live_enabled:
            return "live_trading_disabled"
        if self.trading_mode != TradingMode.LIVE.value:
            return "not_live_mode"
        if not self.session_manager or not getattr(self.session_manager, "is_valid", False):
            return "session_invalid"
        if not self._smart_api():
            return "smart_api_unavailable"
        if order_request.quantity <= 0:
            return "invalid_quantity"
        if order_request.side not in {OrderSide.BUY.value, OrderSide.SELL.value}:
            return "unsupported_side"
        if order_request.order_type not in {OrderType.MARKET.value, OrderType.LIMIT.value}:
            return "unsupported_order_type"
        if self.risk_approval_checker and not self.risk_approval_checker(order_request):
            return "risk_approval_missing"
        return None

    def _smart_api(self):
        return getattr(self.session_manager, "smart_api", None) or getattr(self.session_manager, "smart", None)

    def _rejected_event(self, order_request: OrderRequestEvent, reason: str) -> OrderStateEvent:
        state = self.order_state_machine.create_order(order_request, TradingMode.LIVE.value)
        return self.order_state_machine.transition(
            state.order_id,
            OrderStatus.REJECTED.value,
            reject_reason=reason,
        )

    def _build_angel_params(self, order_request: OrderRequestEvent) -> dict:
        # Keep this minimal and sanitized. Token resolution is intentionally outside this class.
        return {
            "variety": "NORMAL",
            "tradingsymbol": order_request.symbol,
            "transactiontype": order_request.side,
            "exchange": "NSE",
            "ordertype": order_request.order_type,
            "producttype": "INTRADAY",
            "duration": "DAY",
            "quantity": str(order_request.quantity),
        }

    def _extract_order_id(self, response) -> Optional[str]:
        if isinstance(response, str):
            return response
        if isinstance(response, dict):
            data = response.get("data") if isinstance(response.get("data"), dict) else response
            for key in ("orderid", "order_id", "uniqueorderid"):
                value = data.get(key)
                if value:
                    return str(value)
        return None
