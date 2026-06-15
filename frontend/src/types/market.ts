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

export interface CandlesResponse {
  symbol: string;
  timeframe: string;
  candles: OHLCV[];
  count: number;
  has_live_candle: boolean;
  source: string;
  fetch_result?: unknown;
  warning?: string | null;
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

export interface HoldingsResponse {
  status: string;
  holdings: Holding[];
  source?: string;
}

export interface Position {
  symbol: string;
  netQty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  dayPnl: number;
}

export interface PositionsResponse {
  status: string;
  positions: Position[];
  source?: string;
}

export interface Funds {
  availableCash: number;
  usedMargin: number;
  availableMargin: number;
  totalPortfolioValue: number;
}

export interface FundsResponse {
  status: string;
  funds: Funds | null;
  source?: string;
}

export type StrategyType =
  | 'EMA'
  | 'RSI'
  | 'VWAP'
  | 'MACD'
  | 'CUSTOM'
  | string;
export type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | string;

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  status: StrategyStatus;
  lastSignal?: string;
}

// Raw config returned by /strategies/configs (Pydantic-typed fields).
export interface StrategyConfig {
  id?: number;
  strategy_name: string;
  display_name?: string;
  status?: string;
  last_signal_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface StrategyTemplateParam {
  type: string;
  default?: unknown;
  minimum?: number;
  [k: string]: unknown;
}

export interface StrategyTemplate {
  strategy_name: string;
  display_name: string;
  description?: string;
  params_schema?: Record<string, StrategyTemplateParam>;
  required_indicators?: string[];
  supports_backtest?: boolean;
  live_execution_enabled?: boolean;
}

export interface StrategyTemplatesResponse {
  templates: StrategyTemplate[];
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

export interface PendingSignalsResponse {
  pending_count: number;
  signals: RawSignal[];
}

export interface SignalHistoryResponse {
  total: number;
  strategy_id_filter?: number | null;
  signals: RawSignal[];
}

// Shape returned by /strategies/signals/{history,pending}.
export interface RawSignal {
  id: number | string;
  strategy_id: number | string;
  symbol: string;
  side?: string;
  confidence?: number;
  reason?: string;
  price: number;
  timeframe?: string;
  source_candle_time?: number | string;
  status: string;
  dismiss_reason?: string | null;
  created_at?: string;
  [k: string]: unknown;
}

export interface InstrumentSearchResult {
  symbol: string;
  clean_symbol?: string;
  name: string;
  token?: string;
  exchange: string;
  sector?: string;
  instrument_type?: string;
  lot_size?: number;
  tick_size?: number;
}

export interface InstrumentSearchResponse {
  query: string;
  results: InstrumentSearchResult[];
}

export interface AIChatResponse {
  response: string;
}
