from copy import deepcopy

from backend.core.events import OrderStateEvent, PortfolioEvent
from backend.core.types import OrderSide, OrderStatus
from backend.execution.fee_model import NSEFeeModel


def _money(value: float) -> float:
    return round(float(value), 2)


class PositionTracker:
    def __init__(self, fee_model: NSEFeeModel | None = None):
        self.fee_model = fee_model or NSEFeeModel()
        self._positions: dict[str, dict] = {}
        self._fill_history: list[dict] = []
        self.realized_pnl = 0.0
        self.gross_pnl = 0.0
        self.total_fees = 0.0

    def on_fill(self, order_event: OrderStateEvent, fees: dict | None = None) -> None:
        if order_event.status != OrderStatus.FILLED.value:
            return
        price = order_event.avg_fill_price
        qty = int(order_event.filled_quantity or 0)
        if price is None or price <= 0 or qty <= 0:
            return
        fees = fees or self.fee_model.calculate(order_event.side, qty, price)
        fee_total = float(fees.get("total_fees") or 0.0)
        symbol = order_event.symbol.upper()
        position = self._positions.get(symbol)
        if position is None:
            position = self._empty_position(symbol)
            self._positions[symbol] = position

        if order_event.side == OrderSide.BUY.value:
            old_qty = position["quantity"]
            new_qty = old_qty + qty
            position["avg_price"] = ((position["avg_price"] * old_qty) + (price * qty)) / new_qty
            position["quantity"] = new_qty
            position["side"] = "LONG"
        elif order_event.side == OrderSide.SELL.value:
            exit_qty = min(qty, position["quantity"])
            if exit_qty > 0:
                gross = (price - position["avg_price"]) * exit_qty
                self.gross_pnl += gross
                self.realized_pnl += gross - fee_total
                position["realized_pnl"] += gross - fee_total
                position["quantity"] -= exit_qty
                if position["quantity"] == 0:
                    position["avg_price"] = 0.0
                    position["unrealized_pnl"] = 0.0
                    position["ltp"] = None

        self.total_fees += fee_total
        position["fees"] += fee_total
        position["last_fill_price"] = price
        self._fill_history.append(
            {
                "event_id": order_event.event_id,
                "order_id": order_event.order_id,
                "symbol": symbol,
                "side": order_event.side,
                "quantity": qty,
                "price": price,
                "fees": fee_total,
            }
        )

    def update_unrealized(self, symbol: str, ltp: float) -> None:
        if ltp is None:
            return
        position = self._positions.get(symbol.upper())
        if not position or position["quantity"] <= 0:
            return
        position["ltp"] = float(ltp)
        position["unrealized_pnl"] = (float(ltp) - position["avg_price"]) * position["quantity"]

    def update_many_unrealized(self, prices: dict[str, float]) -> None:
        for symbol, price in prices.items():
            self.update_unrealized(symbol, price)

    def get_position(self, symbol: str) -> dict | None:
        position = self._positions.get(symbol.upper())
        if not position or position["quantity"] <= 0:
            return None
        return self._serializable_position(position)

    def get_all_positions(self) -> list[dict]:
        return [
            self._serializable_position(position)
            for position in self._positions.values()
            if position["quantity"] > 0
        ]

    def total_open_notional(self) -> float:
        total = 0.0
        for position in self._positions.values():
            if position["quantity"] <= 0:
                continue
            mark = position["ltp"] if position["ltp"] is not None else position["avg_price"]
            total += position["quantity"] * mark
        return _money(total)

    def get_summary(self) -> dict:
        unrealized = sum(position["unrealized_pnl"] for position in self._positions.values())
        net_pnl = self.gross_pnl + unrealized - self.total_fees
        return {
            "realized_pnl": _money(self.realized_pnl),
            "unrealized_pnl": _money(unrealized),
            "gross_pnl": _money(self.gross_pnl + unrealized),
            "total_fees": _money(self.total_fees),
            "net_pnl": _money(net_pnl),
            "open_positions_count": len(self.get_all_positions()),
            "total_open_notional": self.total_open_notional(),
        }

    def build_portfolio_event(self) -> PortfolioEvent:
        summary = self.get_summary()
        return PortfolioEvent(
            positions=self.get_all_positions(),
            unrealised_pnl=summary["unrealized_pnl"],
            realised_pnl=summary["realized_pnl"],
            total_pnl=summary["net_pnl"],
            daily_drawdown=0.0,
            trading_mode="PAPER",
            equity=None,
            cash=None,
        )

    @property
    def fill_history(self) -> list[dict]:
        return deepcopy(self._fill_history)

    def _empty_position(self, symbol: str) -> dict:
        return {
            "symbol": symbol,
            "side": None,
            "quantity": 0,
            "avg_price": 0.0,
            "ltp": None,
            "unrealized_pnl": 0.0,
            "realized_pnl": 0.0,
            "fees": 0.0,
            "last_fill_price": None,
        }

    def _serializable_position(self, position: dict) -> dict:
        copy = deepcopy(position)
        for key in ("avg_price", "unrealized_pnl", "realized_pnl", "fees", "last_fill_price"):
            if copy[key] is not None:
                copy[key] = _money(copy[key])
        if copy["ltp"] is not None:
            copy["ltp"] = _money(copy["ltp"])
        copy["market_value"] = _money(copy["quantity"] * (copy["ltp"] if copy["ltp"] is not None else copy["avg_price"]))
        return copy
