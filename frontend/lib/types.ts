// =====================================================
// MAET Terminal OS — Type Definitions
// =====================================================

// ----- Workspace / Preset -----
export type WorkspaceId =
  | 'trade'
  | 'markets'
  | 'charts'
  | 'portfolio'
  | 'strategy'
  | 'risk'
  | 'journal'

export type PresetId =
  | 'scalper'
  | 'swing'
  | 'risk-monitor'
  | 'strategy-lab'
  | 'market-discovery'
  | 'portfolio-review'

export type RightPanelTab = 'order' | 'symbol' | 'risk' | 'signals' | 'notes'

export type DockTabId =
  | 'orders'
  | 'positions'
  | 'holdings'
  | 'trades'
  | 'pnl'
  | 'signals'
  | 'events'
  | 'system-health'

// ----- Data Quality -----
export type DataQuality =
  | 'LIVE'
  | 'STALE'
  | 'DELAYED'
  | 'UNAVAILABLE'
  | 'BACKEND OFFLINE'
  | 'MOCK'
  | 'LOADING'
  | 'ERROR'

export type PortfolioDataQuality =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'STALE'
  | 'BACKEND OFFLINE'
  | 'LOADING'
  | 'ERROR'

export type OperatorState =
  | 'ONLINE'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'OFFLINE'
  | 'LOCKED'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'BACKEND OFFLINE'

// ----- Market data -----
export interface Instrument {
  symbol: string
  name: string
  exchange: string
  token: string
  instrument_type?: string
  lot_size?: number
  tick_size?: number
}

export interface MarketWatchRow {
  symbol: string
  name?: string
  exchange?: string
  token?: string
  ltp?: number | null
  previous_ltp?: number | null
  change?: number | null
  change_pct?: number | null
  volume?: number | null
  best_bid?: number | null
  best_ask?: number | null
  spread?: number | null
  vwap?: number | null
  last_update?: string | null
  stale?: boolean
  quality?: DataQuality
}

export interface IndexSnapshot {
  symbol: string
  name?: string
  exchange?: string
  token?: string | null
  ltp: number | null
  change: number | null
  change_pct: number | null
  status?: string
  quality?: DataQuality
}

// ----- Live tick payload -----
export interface TickPayload {
  symbol: string
  token?: string
  exchange?: string
  ltp?: number
  price?: number
  best_bid?: number
  best_ask?: number
  spread?: number
  vwap?: number
  volume?: number
  bid_qty?: number
  ask_qty?: number
  ltq?: number
  exchange_timestamp?: string
  received_at?: string
  signal?: 'BUY' | 'SELL' | 'NEUTRAL'
  portfolio?: PortfolioPerformance
  mode?: 'PAPER' | 'LIVE'
  auto_pilot?: boolean
}

export interface PortfolioPerformance {
  unrealized_pnl: number
  realized_pnl: number
  total_trades: number
  win_rate: number
  current_capital: number
  max_drawdown: number
}

// ----- System / Operator status -----
export interface GatewayStatus {
  connection_state?: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'
  tick_count?: number
  dropped_tick_count?: number
  drop_rate_pct?: number
  subscribed_symbols?: string[] | number
  last_tick_age_seconds?: number
  last_error?: string | null
}

export interface BrokerStatus {
  configured: boolean
  logged_in: boolean
  feed_token_available: boolean
  websocket_started: boolean
  last_error: string | null
  gateway?: GatewayStatus
}

export interface TickBusStats {
  total?: number
  dropped?: number
  drop_rate_pct?: number
  current_size?: number
  maxsize?: number
}

export interface EventBusStats {
  total?: number
  by_type?: Record<string, number>
  failed_handler_count?: number
  history_size?: number
}

export interface CandleStoreStats {
  symbols?: string[]
  candle_counts?: Record<string, Record<string, number>>
  supported_timeframes?: Timeframe[]
}

export interface TerminalStatus {
  app?: { status: string }
  broker?: BrokerStatus
  gateway?: GatewayStatus | null
  event_bus?: EventBusStats
  tick_bus?: TickBusStats | null
  candles?: CandleStoreStats
  portfolio?: PortfolioSummary
  trading_mode?: 'PAPER' | 'LIVE'
}

export interface PortfolioSummary {
  realized_pnl: number | null
  unrealized_pnl: number | null
  gross_pnl: number | null
  total_fees: number | null
  net_pnl: number | null
  open_positions_count: number
  total_open_notional: number | null
  equity: number | null
  current_drawdown: number | null
  max_drawdown: number | null
  data_status: PortfolioDataQuality
  trading_mode?: 'PAPER' | 'LIVE'
  source_of_truth?: string
}

export interface PortfolioPosition {
  symbol: string
  quantity: number
  avg_price: number | null
  ltp: number | null
  realized_pnl: number | null
  unrealized_pnl: number | null
  gross_pnl?: number | null
  fees: number | null
  net_pnl?: number | null
  open_notional?: number | null
  market_value?: number | null
  last_update?: string | null
  quality: DataQuality
}

export interface PortfolioHolding {
  symbol: string
  quantity: number
  average_price: number | null
  ltp: number | null
  value: number | null
  pnl: number | null
  data_status: PortfolioDataQuality
  last_update?: string | null
}

export interface EquityCurvePoint {
  timestamp: string
  equity: number
  drawdown: number
}

export interface ReconciliationMismatch {
  symbol: string
  field: string
  internal_value: unknown
  broker_value: unknown
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  message: string
}

export interface ReconciliationStatus {
  positions: ReconciliationMismatch[]
  holdings: ReconciliationMismatch[]
  summary: {
    mismatch_count: number
    by_severity: Record<string, number>
    ok: boolean
  }
  data_status: PortfolioDataQuality
}

// ----- Health endpoint -----
export interface HealthResponse {
  status: 'online' | 'offline'
  mode: 'PAPER' | 'LIVE'
  broker: BrokerStatus
  portfolio: PortfolioPerformance
}

// ----- Candle -----
export interface Candle {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

// ----- Events / Logs / Signals -----
export type EventSeverity = 'info' | 'success' | 'warning' | 'error'

export interface SystemEvent {
  id: string
  event_type: string
  ts: number
  component?: string
  severity: EventSeverity
  message: string
  symbol?: string
  payload?: unknown
  quality?: DataQuality
}

export interface SignalEvent {
  symbol: string
  strategy_name?: string
  action: 'BUY' | 'SELL' | 'NEUTRAL'
  strength?: number
  reason?: string
  ltp?: number
  generated_at?: string
  ts?: number
  quality?: DataQuality
}

// ----- Watchlist -----
export interface WatchlistGroup {
  id: string
  name: string
  symbols: string[]
}

// ----- Right panel rows (placeholders) -----
export interface OrderRow {
  id: string
  ts: number
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number | null
  status: string
  mode: 'PAPER' | 'LIVE'
}

export interface PositionRow {
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  avg_price: number
  ltp: number | null
  unrealized_pnl: number | null
}

export interface HoldingRow {
  symbol: string
  qty: number
  avg_price: number
  ltp: number | null
  pnl: number | null
}

export interface TradeRow {
  ts: number
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  mode: 'PAPER' | 'LIVE'
}

// ----- WebSocket envelope -----
export interface WsEnvelope<T = unknown> {
  type: string
  payload?: T
  ts?: string
  // Some legacy events may flatten fields onto root
  [k: string]: unknown
}

// ----- Chart timeframe -----
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '1h' | '1d'
