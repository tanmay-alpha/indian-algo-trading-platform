// =====================================================
// MAET Terminal OS — Type Definitions
// =====================================================

// ----- Workspace / Preset -----
export type WorkspaceId =
  | 'trade'
  | 'markets'
  | 'strategy'
  | 'portfolio'
  | 'oms'
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
  | 'NOT SUBSCRIBED'
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
export type NseMarketSession = 'PRE_MARKET' | 'OPEN' | 'LIVE' | 'POST_MARKET' | 'CLOSED' | 'WEEKEND'

export interface ConnectivityDiagnostics {
  apiTarget: string
  wsTarget: string
  restHealthOk: boolean | null
  restTerminalStatusOk: boolean | null
  wsConstructorCalled: boolean
  wsOpen: boolean
  wsLastCloseCode: number | string | null
  wsLastError: string | null
  lastWsMessageType: string | null
  updatedAt: number | null
}

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
  source?: 'db' | 'fallback'
}

// ----- Persistent Watchlist types (Phase 19E) -----
export interface PersistentWatchlistItem {
  id?: number
  watchlist_id?: number
  symbol: string
  exchange: string
  token?: string | null
  created_at?: string | null
  source?: 'db' | 'fallback'
  ltp?: number | null
  stale?: boolean
}

export interface PersistentWatchlist {
  id: number
  name: string
  user_id?: string
  item_count: number
  created_at?: string | null
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

export interface PatternMarker {
  time: string | number
  pattern: string
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  candle_index: number
  description: string
}

export interface PatternResponse {
  symbol: string
  timeframe: string
  available: boolean
  reason?: string
  markers: PatternMarker[]
  count: number
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

// ----- Observability -----
export interface MetricPoint {
  ts: string
  value: number
}

export interface ObservabilitySummary {
  uptime_seconds: number
  sample_count: number
  series_names: string[]
  latest: Record<string, number | null>
  started_at: string
}

export interface ObservabilityMetricsResponse {
  summary: ObservabilitySummary
  series: Record<string, MetricPoint[]>
  note: string
}

export interface ObservabilityEventEntry {
  id: number
  event_type: string
  symbol: string | null
  summary: string
  payload_preview: string
  ts: string
}

export interface ObservabilityEventsResponse {
  entries: ObservabilityEventEntry[]
  total_matched: number
  total_stored: number
  filters: {
    event_type: string | null
    symbol: string | null
  }
}

export interface HealthTimelineEvent {
  ts: string
  component: string
  state: string
  detail: string
}

export interface HealthTimelineResponse {
  events: HealthTimelineEvent[]
  current_states: Record<string, string>
}

export interface DowntimeIncident {
  component: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
}

export interface ObservabilityStatus {
  metrics_samples: number
  event_log_entries: number
  health_events: number
  uptime_seconds: number
  error_count: number
  sampler_running: boolean
}

export interface StrategyRunHistoryEntry {
  strategy_name: string
  symbol: string
  timeframe: string
  params: Record<string, unknown>
  metrics: Partial<BacktestMetrics>
  ts: string
}

export interface StrategyRunHistoryResponse {
  runs: StrategyRunHistoryEntry[]
  count: number
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
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w'

// =====================================================
// OMS / Order Blotter Types (Phase 18L)
// =====================================================

export interface OmsHealthResponse {
  status: 'ok' | string
  oms_initialized: boolean
  queried_at: string
}

export interface OmsSummary {
  total_orders: number
  active_orders: number
  terminal_orders: number
  filled_orders: number
  rejected_orders: number
  partial_fill_count: number
  fill_count: number
  latest_order_at: string | null
  latest_fill_at: string | null
}

export interface OmsOrder {
  request_id: string
  client_order_id: string | null
  broker_order_id: string | null
  symbol: string
  side: 'BUY' | 'SELL' | string
  quantity: number
  order_type: 'MARKET' | 'LIMIT' | string
  mode: 'PAPER' | 'LIVE' | string
  status: string
  reject_reason: string | null
  avg_fill_price: number | null
  created_at: string | null
  updated_at: string | null
}

export interface OmsEvent {
  request_id: string
  event_type: string
  status: string | null
  reason: string | null
  created_at: string | null
}

export interface OmsFill {
  fill_id: string
  request_id: string
  broker_order_id: string | null
  symbol: string
  side: string
  filled_quantity: number
  fill_price: number
  fees: number | null
  source: string | null
  created_at: string | null
}

export interface OrderAuditBundle {
  order: OmsOrder | null
  events: OmsEvent[]
  fills: OmsFill[]
  queried_at?: string
}

export interface OmsStatusResponse {
  oms: OmsSummary | null
  in_memory_active_orders: number
  portfolio_rebuild: {
    fills_processed: number
    skipped_rows: number
    rebuilt_positions: string[]
    warnings_count: number
    source: string
    last_rebuild_at: string | null
  } | null
  queried_at: string
  trading_mode: string
}

export interface OmsReconciliationStatus {
  status: 'ok' | 'no_report' | string
  message?: string
  report?: Record<string, unknown>
  last_run_at: string | null
  queried_at: string
}

/** Structured OMS data-availability states */
export type OmsDataState = 'LOADING' | 'ONLINE' | 'ADMIN_REQUIRED' | 'BACKEND_UNAVAILABLE' | 'ERROR'

// =====================================================
// Strategy Runtime & Scheduler Types (Phase 21D/E)
// =====================================================

export type StrategyRunStatus = 'STOPPED' | 'RUNNING' | 'PAUSED' | 'ERROR'

export interface StrategyConfigRuntime {
  id: number
  name: string
  template_id: string
  symbols: string[]
  timeframe: string
  parameters: Record<string, unknown>
  status: StrategyRunStatus
  mode: 'PAPER' | 'REVIEW_ONLY'
  auto_paper_enabled: boolean
  evaluation_interval_seconds: number
  last_evaluated_at: string | null
  next_evaluation_at: string | null
  max_signals_per_day: number
  cooldown_seconds: number
  created_at: string
  updated_at: string
}

export interface StrategySchedulerStatus {
  running: boolean
  strategies_tracked: number
  last_tick_at: string | null
  tick_interval_seconds: number
  strategy_ids: number[]
}

export type SignalStatus = 'GENERATED' | 'VALIDATED' | 'APPROVED_PAPER' | 'PAPER_EXECUTED' | 'REJECTED' | 'DISMISSED' | 'ERROR'

export interface PendingSignal {
  id: number
  strategy_id: number
  symbol: string
  side: 'BUY' | 'SELL' | string
  confidence: number | null
  reason: string | null
  price: number | null
  timeframe: string | null
  source_candle_time: string | null
  status: SignalStatus
  dismiss_reason: string | null
  created_at: string
}

export type SignalHistoryItem = PendingSignal

// =====================================================
// Broker Account Read-Only Types (Phase 22A)
// =====================================================

export type BrokerAccountStatus = 'OK' | 'BROKER_SESSION_UNAVAILABLE' | 'BROKER_ERROR'

export interface BrokerSessionStatus {
  status: BrokerAccountStatus
  is_valid: boolean
  auth_token_available: boolean
  feed_token_available: boolean
  last_error?: string | null
  last_refresh?: string | null
}

export interface BrokerHolding {
  symbol: string
  isin: string | null
  quantity: number | null
  avg_price: number | null
  ltp: number | null
  realised_quantity: number | null
  product: string
  exchange: string
}

export interface BrokerPosition {
  symbol: string
  product: string
  exchange: string
  net_qty: number | null
  avg_price: number | null
  ltp: number | null
  unrealised_pnl: number | null
  realised_pnl: number | null
}

export interface BrokerFunds {
  available_cash: number | null
  net: number | null
  used_margin: number | null
  available_intraday_payin: number | null
  collateral: number | null
  m2mrealized: number | null
  m2munrealized: number | null
}

export interface BrokerOrderRow {
  order_id_masked: string
  symbol: string
  side: string
  quantity: number | null
  price: number | null
  status: string
  product: string
  exchange: string
  order_type: string
  order_time: string
}

export interface BrokerTradeRow {
  trade_id_masked: string
  symbol: string
  side: string
  quantity: number | null
  price: number | null
  product: string
  exchange: string
  trade_time: string
}

export interface BrokerAccountSnapshot {
  status: BrokerAccountStatus
  holdings: BrokerHolding[]
  positions: BrokerPosition[]
  funds: BrokerFunds
  orders: BrokerOrderRow[]
  trades: BrokerTradeRow[]
  synced_at: string
  source: string
  last_history_import_time: string | null
  last_pnl_calculation_time: string | null
  total_historical_trades: number | null
  total_historical_orders: number | null
}

// =====================================================
// Manual Order Validation Types (Phase 3)
// =====================================================

export interface ManualOrderStatusResponse {
  mode: string
  validation_only: boolean
  dry_run: boolean
  live_execution_enabled: boolean
  broker_mutation_allowed: boolean
  creates_fill: boolean
  creates_broker_order: boolean
}

export interface ManualOrderValidateRequest {
  symbol: string
  exchange: string
  side: string
  quantity: number
  product_type: string
  order_type: string
  price_override?: number | null
}

export interface ManualOrderTicket {
  ticket_id: string
  created_at: string
  symbol: string
  exchange: string
  side: string
  quantity: number
  product_type: string
  order_type: string
  price: number | null
  estimated_notional: number | null
  price_source: string
  price_is_override: boolean
  status: string
  validation_summary: string
  rejection_reason: string | null
  validation_only: boolean
  dry_run: boolean
  live_execution_enabled: boolean
  broker_mutation_allowed: boolean
  creates_fill: boolean
  creates_broker_order: boolean
}

// =====================================================
// Phase 6 watchlists and candles
// =====================================================

export interface InstrumentSearchResult {
  symbol: string
  name: string
  exchange: string
  token?: string
  instrument_token?: string
  segment?: string
}

export type WatchlistDataStatus = 'loading' | 'error' | 'offline' | 'empty' | 'data'

export interface WatchlistItem {
  symbol: string
  name: string
  exchange: string
  ltp?: number | null
  change?: number | null
  changePercent?: number | null
  volume?: number | null
  dataStatus?: WatchlistDataStatus
}

export type ChartDataState = 'loading' | 'error' | 'offline' | 'empty' | 'data'


