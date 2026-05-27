# backend/portfolio/portfolio_manager.py

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PortfolioManager:

    def __init__(self, initial_capital=1000):

        self.initial_capital = initial_capital
        self.current_capital = initial_capital

        self.open_positions = {}
        self.trade_history = []

        self.realized_pnl = 0.0
        self.unrealized_pnl = 0.0

        self.max_equity = initial_capital
        self.max_drawdown = 0.0

    # ==========================================
    # OPEN POSITION
    # ==========================================
    def open_position(self, symbol, side, quantity, entry_price):

        self.open_positions[symbol] = {
            "side": side,
            "quantity": quantity,
            "entry_price": entry_price,
            "timestamp": datetime.now()
        }

        logger.info("PORTFOLIO: Position Opened -> %s %s %s @ %s", symbol, side, quantity, entry_price)

    # ==========================================
    # CLOSE POSITION
    # ==========================================
    def close_position(self, symbol, exit_price):

        if symbol not in self.open_positions:
            return 0

        position = self.open_positions[symbol]

        side = position["side"]
        qty = position["quantity"]
        entry = position["entry_price"]

        if side == "BUY":
            pnl = (exit_price - entry) * qty
        else:
            pnl = (entry - exit_price) * qty

        # Update capital & PnL
        self.realized_pnl += pnl
        self.current_capital += pnl

        trade_record = {
            "timestamp": datetime.now(),
            "symbol": symbol,
            "side": side,
            "quantity": qty,
            "entry": entry,
            "exit": exit_price,
            "pnl": pnl,
            "capital_after_trade": self.current_capital
        }

        self.trade_history.append(trade_record)

        del self.open_positions[symbol]

        self.update_drawdown()

        logger.info("PORTFOLIO: Trade Closed -> PnL: %.2f", pnl)
        logger.debug("PORTFOLIO: Current Capital: %.2f", self.current_capital)

        return pnl

    # ==========================================
    # UPDATE UNREALIZED PNL
    # ==========================================
    def update_unrealized(self, symbol, current_price):

        if symbol not in self.open_positions:
            self.unrealized_pnl = 0
            return

        position = self.open_positions[symbol]

        side = position["side"]
        qty = position["quantity"]
        entry = position["entry_price"]

        if side == "BUY":
            pnl = (current_price - entry) * qty
        else:
            pnl = (entry - current_price) * qty

        self.unrealized_pnl = pnl

    # ==========================================
    # UPDATE DRAWDOWN
    # ==========================================
    def update_drawdown(self):

        equity = self.current_capital

        if equity > self.max_equity:
            self.max_equity = equity

        drawdown = self.max_equity - equity

        if drawdown > self.max_drawdown:
            self.max_drawdown = drawdown

    # ==========================================
    # PERFORMANCE SUMMARY
    # ==========================================
    def get_performance(self):

        total_trades = len(self.trade_history)
        wins = len([t for t in self.trade_history if t["pnl"] > 0])

        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

        return {
            "initial_capital": self.initial_capital,
            "current_capital": self.current_capital,
            "realized_pnl": self.realized_pnl,
            "unrealized_pnl": self.unrealized_pnl,
            "total_trades": total_trades,
            "win_rate": round(win_rate, 2),
            "max_drawdown": self.max_drawdown
        }
