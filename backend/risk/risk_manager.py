# backend/risk/risk_manager.py

import csv
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)


class RiskManager:

    def __init__(
        self,
        initial_capital=1000,
        risk_per_trade=0.01,
        max_daily_loss_pct=0.03,
        max_trades_per_day=3,
        max_open_positions=2
    ):

        # =============================
        # Capital & Risk Settings
        # =============================
        self.initial_capital = initial_capital
        self.equity = initial_capital

        self.risk_per_trade = risk_per_trade
        self.max_daily_loss_pct = max_daily_loss_pct
        self.max_trades_per_day = max_trades_per_day
        self.max_open_positions = max_open_positions

        # =============================
        # Daily Controls
        # =============================
        self.daily_loss = 0
        self.trades_today = 0
        self.kill_switch = False
        self._breach_log = []

        # =============================
        # Trade Tracking
        # =============================
        self.positions = {}
        self.trade_history = []

        self._init_trade_log()

    # ============================================
    # INITIALIZE TRADE LOG FILE
    # ============================================
    def _init_trade_log(self):
        os.makedirs("logs", exist_ok=True)
        self.log_file = "logs/trade_log.csv"

        if not os.path.exists(self.log_file):
            with open(self.log_file, mode="w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow([
                    "Timestamp",
                    "Symbol",
                    "Side",
                    "Entry",
                    "Exit",
                    "Quantity",
                    "PnL",
                    "Equity"
                ])

    # ============================================
    # CAN TAKE TRADE?
    # ============================================
    def can_take_trade(self, symbol):

        if self.kill_switch:
            logger.warning("RISK: Kill switch active")
            return False

        if self.trades_today >= self.max_trades_per_day:
            logger.warning("RISK: Max trades reached today")
            return False

        if len(self.positions) >= self.max_open_positions:
            logger.warning("RISK: Max open positions reached")
            return False

        if self.daily_loss >= self.initial_capital * self.max_daily_loss_pct:
            logger.warning("RISK: Daily loss limit hit")
            self.kill_switch = True
            self._record_breach("DAILY_LOSS", "Daily loss limit hit")
            return False

        if symbol in self.positions:
            return False

        return True

    # ============================================
    # POSITION SIZING
    # ============================================
    def calculate_position_size(self, entry_price, stop_loss_price):

        risk_amount = self.equity * self.risk_per_trade
        risk_per_share = abs(entry_price - stop_loss_price)

        if risk_per_share == 0:
            return 0

        qty = risk_amount // risk_per_share
        return int(qty)

    # ============================================
    # OPEN POSITION
    # ============================================
    def open_position(self, symbol, side, quantity, entry_price):

        self.positions[symbol] = {
            "side": side,
            "quantity": quantity,
            "entry_price": entry_price,
            "timestamp": datetime.now()
        }

        logger.info("RISK: Position Opened: %s", symbol)

    # ============================================
    # CHECK EXIT CONDITIONS
    # ============================================
    def check_exit(self, symbol, current_price):

        if symbol not in self.positions:
            return None

        pos = self.positions[symbol]
        entry = pos["entry_price"]
        qty = pos["quantity"]
        side = pos["side"]

        if side == "BUY":
            pnl = (current_price - entry) * qty
        else:
            pnl = (entry - current_price) * qty

        # 1% Take Profit
        if pnl >= entry * 0.01 * qty:
            return "TAKE_PROFIT"

        # 0.5% Stop Loss
        if pnl <= -entry * 0.005 * qty:
            return "STOP_LOSS"

        return None

    # ============================================
    # CLOSE POSITION
    # ============================================
    def close_position(self, symbol, exit_price):

        if symbol not in self.positions:
            return

        pos = self.positions.pop(symbol)

        entry = pos["entry_price"]
        qty = pos["quantity"]
        side = pos["side"]

        if side == "BUY":
            pnl = (exit_price - entry) * qty
        else:
            pnl = (entry - exit_price) * qty

        self.equity += pnl
        self.trades_today += 1

        if pnl < 0:
            self.daily_loss += abs(pnl)

        if self.daily_loss >= self.initial_capital * self.max_daily_loss_pct:
            logger.warning("RISK: Daily loss limit reached -> Activating Kill Switch")
            self.kill_switch = True
            self._record_breach("DAILY_LOSS", "Daily loss limit reached")

        self.trade_history.append({
            "symbol": symbol,
            "pnl": pnl
        })

        self._log_trade(symbol, side, entry, exit_price, qty, pnl)

        logger.info("RISK: Trade Closed | PnL: %.2f | Equity: %.2f", pnl, self.equity)

    # ============================================
    # LOG TRADE TO CSV
    # ============================================
    def _log_trade(self, symbol, side, entry, exit_price, qty, pnl):

        with open(self.log_file, mode="a", newline="") as file:
            writer = csv.writer(file)
            writer.writerow([
                datetime.now(),
                symbol,
                side,
                entry,
                exit_price,
                qty,
                pnl,
                self.equity
            ])

    # ============================================
    # RESET DAILY LIMITS (CALL AT MARKET OPEN)
    # ============================================
    def reset_daily(self):
        logger.info("RISK: Resetting daily risk controls")
        self.daily_loss = 0
        self.trades_today = 0
        self.kill_switch = False

    def update_daily_pnl(self, pnl: float):
        if pnl < 0:
            self.daily_loss = abs(pnl)
        else:
            self.daily_loss = 0
        if self.daily_loss >= self.initial_capital * self.max_daily_loss_pct:
            self.kill_switch = True
            self._record_breach("DAILY_LOSS", "Daily PnL breached risk limit")

    @property
    def is_trading_halted(self):
        return self.kill_switch

    def get_breach_log(self):
        return list(self._breach_log)

    def _record_breach(self, breach_type, message):
        self._breach_log.append({
            "timestamp": datetime.now().isoformat(),
            "type": breach_type,
            "message": message,
        })
