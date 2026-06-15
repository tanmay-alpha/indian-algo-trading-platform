export interface Quote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Holding {
  symbol: string;
  tradingSymbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPct: number;
  currentValue: number;
}

export interface Position {
  symbol: string;
  netQty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  dayPnl: number;
}

export interface Funds {
  availableCash: number;
  usedMargin: number;
  availableMargin: number;
  totalPortfolioValue: number;
}

export type StrategyType = 'EMA' | 'RSI' | 'VWAP' | 'MACD' | 'CUSTOM';
export type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  status: StrategyStatus;
  lastSignal?: string;
}

export type SignalAction = 'BUY' | 'SELL';
export type SignalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Signal {
  id: string;
  strategyId: string;
  symbol: string;
  action: SignalAction;
  price: number;
  timestamp: string;
  status: SignalStatus;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface AIChatResponse {
  response: string;
}
