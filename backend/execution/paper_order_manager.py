from typing import Optional

from loguru import logger

from backend.core.events import OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.execution.fee_model import NSEFeeModel
from backend.execution.order_state_machine import OrderStateMachine


class PaperOrderManager:
    def __init__(
        self,
        event_bus=None,
        trade_journal=None,
        fee_model: Optional[NSEFeeModel] = None,
        order_state_machine: Optional[OrderStateMachine] = None,
    ):
        self.positions = {}
        self.event_bus = event_bus
        self.trade_journal = trade_journal
        self.fee_model = fee_model or NSEFeeModel()
        self.order_state_machine = order_state_machine or OrderStateMachine(event_bus=event_bus)

    async def place_order(self, order_request: OrderRequestEvent, latest_market: dict) -> OrderStateEvent:
        state = self.order_state_machine.create_order(order_request, TradingMode.PAPER.value)
        fill_price = self._fill_price(order_request, latest_market or {})
        if fill_price is None:
            return self.order_state_machine.transition(
                state.order_id,
                OrderStatus.REJECTED.value,
                reject_reason="market_data_unavailable",
            )

        if order_request.order_type == OrderType.LIMIT.value and not self._limit_crossed(order_request, latest_market):
            return self.order_state_machine.transition(state.order_id, OrderStatus.OPEN.value)

        fees = self.fee_model.calculate(order_request.side, order_request.quantity, fill_price)
        event = self.order_state_machine.transition(
            state.order_id,
            OrderStatus.FILLED.value,
            filled_quantity=order_request.quantity,
            avg_fill_price=fill_price,
        )
        self.positions[order_request.symbol] = {
            "side": order_request.side,
            "quantity": order_request.quantity,
            "entry_price": fill_price,
        }
        if fees["total_fees"] > fees["turnover"] * 0.02:
            logger.warning("Paper fill fees exceed expected threshold")
        if self.trade_journal:
            await self.trade_journal.record_fill(
                event,
                fees,
                order_request.strategy_name,
                order_request.trading_mode,
            )
        return event

    def place_order_legacy(self, symbol, token, side, quantity, price=None):
        if quantity <= 0:
            return {"status": OrderStatus.REJECTED.value, "reason": "invalid_quantity"}
        self.positions[symbol] = {"side": side, "quantity": quantity, "entry_price": price}
        return {"status": "PAPER_EXECUTED", "symbol": symbol, "quantity": quantity}

    def _fill_price(self, order_request: OrderRequestEvent, latest_market: dict) -> Optional[float]:
        if order_request.order_type == OrderType.LIMIT.value:
            return order_request.price
        ltp = latest_market.get("ltp") or latest_market.get("price")
        spread = latest_market.get("spread") or 0.0
        if order_request.side == OrderSide.BUY.value:
            ask = latest_market.get("best_ask")
            return float(ask + spread * 0.1) if ask is not None else self._positive_float(ltp)
        bid = latest_market.get("best_bid")
        return float(bid - spread * 0.1) if bid is not None else self._positive_float(ltp)

    def _limit_crossed(self, order_request: OrderRequestEvent, latest_market: dict) -> bool:
        ltp = latest_market.get("ltp") or latest_market.get("price")
        if ltp is None or order_request.price is None:
            return False
        if order_request.side == OrderSide.BUY.value:
            return float(ltp) <= order_request.price
        return float(ltp) >= order_request.price

    def _positive_float(self, value) -> Optional[float]:
        if value is None:
            return None
        parsed = float(value)
        return parsed if parsed > 0 else None
