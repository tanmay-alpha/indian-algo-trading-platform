from dataclasses import dataclass
from enum import Enum


class TradingMode(str, Enum):
    PAPER = "PAPER"
    LIVE = "LIVE"


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    OPEN = "OPEN"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


@dataclass
class TickData:
    symbol: str
    ltp: float
    best_bid: float
    best_ask: float
    bid_qty: int
    ask_qty: int
    spread: float
    vwap: float
    volume: int
    ltq: int
    timestamp: str
