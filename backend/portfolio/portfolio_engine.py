from typing import Optional

from backend.core.events import EventType, OrderStateEvent
from backend.core.types import OrderStatus, TradingMode
from backend.execution.fee_model import NSEFeeModel
from backend.portfolio.broker_reconciliation import BrokerReconciliation
from backend.portfolio.equity_curve import EquityCurve
from backend.portfolio.holdings_tracker import HoldingsTracker
from backend.portfolio.position_tracker import PositionTracker


class PortfolioEngine:
    def __init__(
        self,
        initial_capital: float = 50000.0,
        event_bus=None,
        trading_mode: str = TradingMode.PAPER.value,
        fee_model: Optional[NSEFeeModel] = None,
    ):
        self.initial_capital = float(initial_capital)
        self.event_bus = event_bus
        self.trading_mode = trading_mode
        self.fee_model = fee_model or NSEFeeModel()
        self.positions = PositionTracker(self.fee_model)
        self.holdings = HoldingsTracker()
        self.equity_curve = EquityCurve(initial_capital=self.initial_capital)
        self.reconciliation = BrokerReconciliation()
        self._last_position_mismatches: list[dict] = []
        self._last_holding_mismatches: list[dict] = []

    async def on_order_state_event(self, event: OrderStateEvent) -> None:
        if event.status != OrderStatus.FILLED.value:
            return
        fees = None
        if event.avg_fill_price and event.filled_quantity:
            fees = self.fee_model.calculate(event.side, event.filled_quantity, event.avg_fill_price)
        self.positions.on_fill(event, fees)
        self._add_equity_point()
        await self._publish_portfolio_event()

    async def on_tick(self, symbol: str, ltp: float) -> None:
        if ltp is None:
            return
        self.positions.update_unrealized(symbol, ltp)
        self._add_equity_point()
        await self._publish_portfolio_event()

    async def reconcile_with_broker_positions(self, broker_positions: list[dict]) -> list[dict]:
        self._last_position_mismatches = self.reconciliation.reconcile_positions(self.get_positions(), broker_positions)
        return self._last_position_mismatches

    async def reconcile_with_broker_holdings(self, broker_holdings: list[dict]) -> list[dict]:
        self._last_holding_mismatches = self.reconciliation.reconcile_holdings(self.get_holdings(), broker_holdings)
        return self._last_holding_mismatches

    def get_positions(self) -> list[dict]:
        return self.positions.get_all_positions()

    def get_holdings(self) -> list[dict]:
        return self.holdings.get_all_holdings()

    def get_summary(self) -> dict:
        position_summary = self.positions.get_summary()
        equity_summary = self.equity_curve.summary()
        return {
            **position_summary,
            "initial_capital": self.initial_capital,
            "equity": round(self.initial_capital + position_summary["net_pnl"], 2),
            "max_drawdown": equity_summary["max_drawdown"],
            "current_drawdown": equity_summary["current_drawdown"],
            "trading_mode": self.trading_mode,
            "source_of_truth": "INTERNAL" if self.trading_mode == TradingMode.PAPER.value else "BROKER",
        }

    def get_equity_curve(self, limit: int = 500) -> list[dict]:
        return self.equity_curve.get_points(limit)

    def status(self) -> dict:
        mismatches = self._last_position_mismatches + self._last_holding_mismatches
        return {
            "trading_mode": self.trading_mode,
            "summary": self.get_summary(),
            "holdings": self.holdings.get_summary(),
            "reconciliation": self.reconciliation.summarize(mismatches),
        }

    def _add_equity_point(self) -> None:
        self.equity_curve.add_point(self.get_summary()["equity"])

    async def _publish_portfolio_event(self) -> None:
        if not self.event_bus:
            return
        event = self.positions.build_portfolio_event()
        event.trading_mode = self.trading_mode
        event.equity = self.get_summary()["equity"]
        event.daily_drawdown = self.equity_curve.current_drawdown()
        await self.event_bus.publish(event)
