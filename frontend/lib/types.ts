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
  | 'WAITING'
  | 'READY'
  | 'WARMING'
  | 'UNAVAILABLE'
  | 'BACKEND OFFLINE'
  | 'MOCK'
  | 'LOADING'
  | 'ERROR'
  | 'MARKET CLOSED'
  | 'PRE-MARKET'
  | 'POST-MARKET'

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

export type WsConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE'
export type StatusSource = 'WS' | 'REST' | 'REST_FALLBACK' | 'NONE'
export type ApiStatus = 'UNKNOWN' | 'WAKING' | 'ONLINE' | 'OFFLINE'
export type BackendWakeState = 'IDLE' | 'WAKING' | 'ONLINE' | 'UNAVAILABLE'
export type NseMarketSession = 'PRE_MARKET' | 'OPEN' | 'POST_MARKET' | 'WEEKEND'

// ----- Market data -----
export interface Instrument {
  symbol: string
  clean_symbol?: string
  name: string
  exchange: string
  token: string
  sector?: string
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
  indicator_engine?: IndicatorEngineStatus
  strategy_engine?: Partial<StrategyStatus>
  portfolio?: PortfolioSummary
  trading_mode?: 'PAPER' | 'LIVE'
  demo_mode?: boolean
  demo_banner?: string | null
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

// ----- Indicators -----
export type IndicatorName =
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'macd'
  | 'atr'
  | 'vwap'
  | 'bollinger_bands'

export type IndicatorOverlayName = 'ema' | 'vwap' | 'bollinger_bands'
export type IndicatorSubpanelName = 'rsi' | 'macd'

export interface ChartOverlayState {
  ema: boolean
  vwap: boolean
  bollinger_bands: boolean
}

export interface IndicatorSubpanelState {
  rsi: boolean
  macd: boolean
}

export interface IndicatorPoint {
  time: string | number
  value: number | null
}

export interface MacdPoint {
  time: string | number
  macd: number | null
  signal: number | null
  histogram: number | null
}

export interface BollingerPoint {
  time: string | number
  middle: number | null
  upper: number | null
  lower: number | null
}

export interface IndicatorEngineStatus {
  available: boolean
  selected_engine: 'cpp' | 'python' | string
  cpp_available: boolean
  fallback_available: boolean
  indicators: IndicatorName[]
  cpp_import_error: string | null
}

export type IndicatorSeries = Array<number | null>

export interface IndicatorResults {
  sma?: IndicatorSeries
  ema?: IndicatorSeries
  rsi?: IndicatorSeries
  atr?: IndicatorSeries
  vwap?: IndicatorSeries
  macd?: {
    macd: IndicatorSeries
    signal: IndicatorSeries
    histogram: IndicatorSeries
  }
  bollinger_bands?: {
    middle: IndicatorSeries
    upper: IndicatorSeries
    lower: IndicatorSeries
  }
  [key: string]: unknown
}

export interface IndicatorResultsResponse {
  symbol?: string
  timeframe?: string
  engine: 'cpp' | 'python' | string
  available: boolean
  reason?: string
  count: number
  results: IndicatorResults
}

export interface IndicatorCalculatePayload {
  close?: number[]
  candles?: Array<Pick<Candle, 'open' | 'high' | 'low' | 'close' | 'volume'>>
  indicators: IndicatorName[]
  params?: Record<string, number>
}

// ----- Strategies / Backtesting -----
export interface StrategyTemplate {
  strategy_name: string
  display_name: string
  description: string
  params_schema: Record<string, unknown>
  required_indicators: string[]
  supports_backtest: boolean
  live_execution_enabled: boolean
}

export interface StrategyConfig {
  strategy_name: string
  symbol: string
  timeframe: string
  params: Record<string, number | string | boolean>
  initial_capital: number
  quantity: number
  fee_bps: number
  slippage_bps: number
}

export interface StrategySignal {
  timestamp: string
  symbol: string
  strategy_name: string
  action: 'BUY' | 'SELL' | 'HOLD' | 'EXIT' | string
  price: number | null
  strength: number
  reason: string
  metadata?: Record<string, unknown>
}

export interface BacktestTrade {
  entry_time: string
  exit_time: string | null
  symbol: string
  side: string
  quantity: number
  entry_price: number
  exit_price: number | null
  gross_pnl: number
  fees: number
  slippage: number
  net_pnl: number
  return_pct: number
  exit_reason: string | null
}

export interface BacktestEquityPoint {
  timestamp: string
  equity: number
  drawdown: number
}

export interface BacktestMetrics {
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  gross_pnl: number
  net_pnl: number
  total_fees: number
  total_slippage: number
  total_return_pct: number
  max_drawdown: number
  profit_factor: number | null
  average_win: number | null
  average_loss: number | null
}

export interface BacktestResult {
  status: string
  strategy_name: string
  symbol: string
  timeframe: string
  engine: string
  candles_used: number
  signals: StrategySignal[]
  trades: BacktestTrade[]
  equity_curve: BacktestEquityPoint[]
  metrics: BacktestMetrics
  reason: string | null
}

export interface StrategyStatus {
  available: boolean
  engine: string
  live_execution_enabled: boolean
  templates_count: number
  supported_strategies: string[]
  backtesting_enabled: boolean
}

export interface ChartSignalMarker {
  time: string | number
  action: 'BUY' | 'EXIT' | string
  price: number | null
  strength: number
  reason: string
}

// ----- Market Discovery -----
export interface MarketMover {
  symbol: string
  ltp: number | null
  change_pct: number | null
  volume: number | null
  is_live: boolean
}

export interface MarketBoardSummary {
  total_symbols_tracked: number
  symbols_with_data: number
  symbols_stale: number
  last_updated: string | null
  note: string
}

export interface DiscoveryBoard {
  summary: MarketBoardSummary
  gainers: MarketMover[]
  losers: MarketMover[]
  most_active: MarketMover[]
  note: string
}

export interface ScreenerFilters {
  rsi_below?: number
  rsi_above?: number
  price_above_ema?: number
  price_below_ema?: number
  price_above_vwap?: boolean
  price_below_vwap?: boolean
  volume_above?: number
  change_pct_above?: number
  change_pct_below?: number
}

export interface ScreenerResultRow {
  symbol: string
  ltp: number | null
  change_pct: number | null
  volume: number | null
  indicators: {
    rsi: number | null
    ema_20: number | null
    vwap: number | null
  }
  is_live: boolean
}

export interface ScreenerResult {
  filters_applied: ScreenerFilters
  timeframe: string
  symbols_evaluated: number
  symbols_passed: number
  results: ScreenerResultRow[]
  note: string
  evaluated_at: string
}

export interface PaginatedInstruments {
  instruments: Instrument[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface DiscoveryStatus {
  instrument_count: number
  sectors_available: number
  symbols_in_market_watch: number
  symbols_with_candle_data: number
  screener_available: boolean
  board_available: boolean
  instrument_master_source: string
  note: string
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
