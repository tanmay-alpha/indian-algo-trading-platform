import asyncio
from typing import Optional

from loguru import logger

from backend.core.events import OrderRequestEvent, OrderStateEvent, LogEvent
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

        # Initialize safety components
        from backend.execution.broker_mutation_guard import BrokerMutationGuard
        from backend.execution.broker_rate_limiter import BrokerRateLimiter
        from backend.execution.manual_order_policy import ManualOrderPolicy

        self.mutation_guard = BrokerMutationGuard(enabled=True)
        self.rate_limiter = BrokerRateLimiter(max_requests=3, window_seconds=1.0)
        self.manual_policy = ManualOrderPolicy(max_quantity=1, max_notional=10000.0)

    async def place_order(self, order_request: OrderRequestEvent, ltp: Optional[float] = None) -> OrderStateEvent:
        # 1. General Safety Rejection checks
        rejection = self._safety_rejection(order_request)
        if rejection:
            return self._rejected_event(order_request, rejection)

        # 2. Broker Mutation Guard Check (Blocks all mutations by default)
        guard_result = self.mutation_guard.check_mutation("place_order", {"request": order_request})
        if guard_result and guard_result.get("blocked"):
            if self.event_bus:
                await self.event_bus.publish(
                    LogEvent(
                        level="WARNING",
                        component="LIVE_SAFETY",
                        message=f"Live order placement blocked by BrokerMutationGuard: {guard_result['reason']}"
                    )
                )
            return self._rejected_event(order_request, guard_result["reason"])

        # 3. Rate Limiting Check
        if not await self.rate_limiter.allow_request():
            if self.event_bus:
                await self.event_bus.publish(
                    LogEvent(
                        level="WARNING",
                        component="LIVE_SAFETY",
                        message=f"Live order placement rate limit exceeded for request: {order_request.event_id}"
                    )
                )
            return self._rejected_event(order_request, "rate_limit_exceeded")

        # 4. Manual Order Policy Check
        is_manual = getattr(order_request, "source", "").upper() == "MANUAL"
        if is_manual:
            from backend.core.config import settings
            is_dry_run = getattr(settings, "dry_run", False) or getattr(settings, "DRY_RUN", False)
            policy_failures = self.manual_policy.validate_manual_order(
                order_request,
                ltp=ltp or 0.0,
                is_dry_run=is_dry_run
            )
            if policy_failures:
                failure_msg = f"Manual order policy failures: {', '.join(policy_failures)}"
                if self.event_bus:
                    await self.event_bus.publish(
                        LogEvent(
                            level="WARNING",
                            component="LIVE_SAFETY",
                            message=f"Live manual order blocked by policy: {failure_msg}"
                        )
                    )
                return self._rejected_event(order_request, f"policy_violation: {', '.join(policy_failures)}")

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
            from backend.execution.broker_error_classifier import BrokerErrorClassifier
            category = BrokerErrorClassifier.classify(exc)
            safe_msg = BrokerErrorClassifier.get_safe_message(exc)
            logger.error(f"Live order placement failed ({category}): {safe_msg}")
            
            if self.event_bus:
                await self.event_bus.publish(
                    LogEvent(
                        level="ERROR",
                        component="LIVE_SAFETY",
                        message=f"Live order placement failed with broker error: {category}"
                    )
                )
            return self.order_state_machine.transition(
                state.order_id,
                OrderStatus.REJECTED.value,
                reject_reason=f"broker_error_{category.lower()}",
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

