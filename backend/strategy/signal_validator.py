import logging
from typing import Optional

from backend.core.events import OrderRequestEvent, SignalEvent, ErrorEvent
from backend.core.types import OrderSide, OrderType

logger = logging.getLogger(__name__)

class SignalValidator:
    def __init__(self, event_bus=None, kill_switch=None, live_trading_enabled: bool = False, default_quantity: int = 1):
        self.event_bus = event_bus
        self.kill_switch = kill_switch
        self.live_trading_enabled = live_trading_enabled
        self.default_quantity = default_quantity

    async def validate_and_route(self, event: SignalEvent, trading_mode: str = "PAPER") -> Optional[OrderRequestEvent]:
        """
        Validates the SignalEvent. If valid, converts it to an OrderRequestEvent and publishes it.
        If invalid, publishes a safe rejection event.
        """
        if event.action == "NEUTRAL":
            logger.debug("Signal is NEUTRAL, no order event emitted.")
            return None

        failed: list[str] = []

        # 1. Reject invalid side/action
        if event.action not in {OrderSide.BUY.value, OrderSide.SELL.value}:
            failed.append("invalid_action")

        # 2. Reject missing symbol
        if not event.symbol:
            failed.append("missing_symbol")

        # 3 & 4. Reject missing/invalid quantity
        quantity = self.default_quantity
        if quantity is None:
            failed.append("missing_quantity")
        elif quantity <= 0:
            failed.append("invalid_quantity")

        # 5. Reject if trading mode is not PAPER unless live is explicitly enabled
        if trading_mode != "PAPER" and not self.live_trading_enabled:
            failed.append("live_trading_disabled")

        # 6. Reject if kill switch is active
        if self.kill_switch and self.kill_switch.is_active:
            failed.append("kill_switch_active")

        if failed:
            reason = ";".join(failed)
            logger.warning(f"SIGNAL VALIDATOR: Rejected signal for {event.symbol}. Reason: {reason}")
            if self.event_bus:
                rejection = ErrorEvent(
                    component="SIGNAL_VALIDATOR",
                    error_type="SIGNAL_REJECTED",
                    safe_message=f"Signal validation failed for {event.symbol or 'unknown'}: {reason}",
                    severity="WARNING",
                )
                await self.event_bus.publish(rejection)
            return None

        # Convert valid SignalEvent to OrderRequestEvent
        order_request = OrderRequestEvent(
            symbol=event.symbol,
            side=event.action,
            quantity=quantity,
            order_type=OrderType.MARKET.value,
            price=event.ltp,
            strategy_name=event.strategy_name,
            signal_event_id=event.event_id,
            trading_mode=trading_mode,
            source="AUTOMATIC",
        )

        logger.info(f"SIGNAL VALIDATOR: Approved signal for {event.symbol} -> Emitting OrderRequestEvent")
        if self.event_bus:
            await self.event_bus.publish(order_request)

        return order_request
