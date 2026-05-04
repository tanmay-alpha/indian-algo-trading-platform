from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class StrategyName(str, Enum):
    EMA_CROSSOVER = "EMA_CROSSOVER"
    RSI_MEAN_REVERSION = "RSI_MEAN_REVERSION"
    MACD_TREND = "MACD_TREND"
    VWAP_PULLBACK = "VWAP_PULLBACK"
    BOLLINGER_BREAKOUT = "BOLLINGER_BREAKOUT"


class SignalAction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    EXIT = "EXIT"


class BacktestStatus(str, Enum):
    SUCCESS = "SUCCESS"
    NO_CANDLES = "NO_CANDLES"
    INVALID_PARAMS = "INVALID_PARAMS"
    ERROR = "ERROR"


class StrategyConfig(BaseModel):
    strategy_name: str
    symbol: str
    timeframe: str = "1m"
    params: dict[str, Any] = Field(default_factory=dict)
    initial_capital: float = 100000.0
    quantity: int = 1
    fee_bps: float = 3.0
    slippage_bps: float = 2.0

    @model_validator(mode="after")
    def validate_config(self):
        if not str(self.symbol or "").strip():
            raise ValueError("symbol is required")
        if self.quantity <= 0:
            raise ValueError("quantity must be positive")
        if self.initial_capital <= 0:
            raise ValueError("initial_capital must be positive")
        if self.fee_bps < 0:
            raise ValueError("fee_bps must be non-negative")
        if self.slippage_bps < 0:
            raise ValueError("slippage_bps must be non-negative")
        return self


class StrategySignal(BaseModel):
    timestamp: str
    symbol: str
    strategy_name: str
    action: str
    price: Optional[float]
    strength: float = Field(ge=0.0, le=1.0)
    reason: str
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        try:
            SignalAction(value)
        except ValueError as exc:
            raise ValueError("unsupported signal action") from exc
        return value


class BacktestTrade(BaseModel):
    entry_time: str
    exit_time: Optional[str]
    symbol: str
    side: str
    quantity: int
    entry_price: float
    exit_price: Optional[float]
    gross_pnl: float
    fees: float
    slippage: float
    net_pnl: float
    return_pct: float
    exit_reason: Optional[str]


class EquityPoint(BaseModel):
    timestamp: str
    equity: float
    drawdown: float


class BacktestMetrics(BaseModel):
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    gross_pnl: float
    net_pnl: float
    total_fees: float
    total_slippage: float
    total_return_pct: float
    max_drawdown: float
    profit_factor: Optional[float]
    average_win: Optional[float]
    average_loss: Optional[float]


class BacktestResult(BaseModel):
    status: str
    strategy_name: str
    symbol: str
    timeframe: str
    engine: str
    candles_used: int
    signals: list[StrategySignal]
    trades: list[BacktestTrade]
    equity_curve: list[EquityPoint]
    metrics: BacktestMetrics
    reason: Optional[str] = None

