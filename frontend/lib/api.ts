import { API_URL, ENDPOINTS } from './constants'
import type {
  HealthResponse,
  Instrument,
  TerminalStatus,
  IndexSnapshot,
  Candle,
  MarketWatchRow,
  PortfolioSummary,
  PortfolioPosition,
  PortfolioHolding,
  EquityCurvePoint,
  ReconciliationStatus,
  IndicatorCalculatePayload,
  IndicatorEngineStatus,
  IndicatorName,
  IndicatorResultsResponse,
  BacktestResult,
  StrategyConfig,
  StrategySignal,
  StrategyStatus,
  StrategyTemplate,
  DiscoveryBoard,
  DiscoveryStatus,
  MarketMover,
  PaginatedInstruments,
  ScreenerFilters,
  ScreenerResult,
} from './types'

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`
  let res: Response
  try {
    res = await fetchWithTimeout(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    })
  } catch {
    throw new APIError('Backend unreachable', 0)
  }
  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      /* ignore */
    }
    throw new APIError(`HTTP ${res.status}`, res.status, detail)
  }
  return res.json() as Promise<T>
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

// ----- Health / Status -----
export const fetchHealth = () => request<HealthResponse>(ENDPOINTS.health)

export const fetchTerminalStatus = () =>
  request<TerminalStatus>(ENDPOINTS.terminalStatus)

// ----- Instruments / Indices -----
export interface InstrumentsSearchResponse {
  query: string
  results: Instrument[]
}

export async function searchInstruments(q: string): Promise<Instrument[]> {
  if (!q || q.trim().length < 2) return []
  const data = await request<InstrumentsSearchResponse>(
    `${ENDPOINTS.searchInstruments}?q=${encodeURIComponent(q.trim())}`
  )
  return data.results || []
}

export interface IndicesResponse {
  indices: IndexSnapshot[]
}

export async function fetchIndices(): Promise<IndexSnapshot[]> {
  const data = await request<IndicesResponse>(ENDPOINTS.indices)
  return data.indices || []
}

// ----- Market Watch -----
export interface MarketWatchResponse {
  symbols: string[]
  items: MarketWatchRow[]
}

export const fetchMarketWatch = () =>
  request<MarketWatchResponse>(ENDPOINTS.marketWatch)

export const setMarketWatch = (symbols: string[]) =>
  request<MarketWatchResponse>(ENDPOINTS.marketWatch, {
    method: 'POST',
    body: JSON.stringify({ symbols }),
  })

// ----- Candles -----
export const fetchCandles = (symbol: string, timeframe = '5m') =>
  request<{ symbol: string; timeframe: string; candles: Candle[] }>(
    `${ENDPOINTS.candles}/${encodeURIComponent(symbol)}?timeframe=${timeframe}`
  )

// ----- Indicators -----
const unavailableIndicatorStatus: IndicatorEngineStatus = {
  available: false,
  selected_engine: 'python',
  cpp_available: false,
  fallback_available: true,
  indicators: ['sma', 'ema', 'rsi', 'macd', 'atr', 'vwap', 'bollinger_bands'],
  cpp_import_error: null,
}

export async function getIndicatorStatus(): Promise<IndicatorEngineStatus> {
  try {
    return await request<IndicatorEngineStatus>(ENDPOINTS.indicatorStatus)
  } catch {
    return unavailableIndicatorStatus
  }
}

export async function getIndicatorsForSymbol(
  symbol: string,
  timeframe: string,
  names: IndicatorName[] = ['ema', 'rsi', 'macd'],
  params: Record<string, number> = {}
): Promise<IndicatorResultsResponse> {
  if (!symbol) {
    return unavailableIndicators(symbol, timeframe, 'NO_SYMBOL')
  }

  const query = new URLSearchParams({
    timeframe,
    names: names.join(','),
  })
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value))
  }

  try {
    return await request<IndicatorResultsResponse>(
      `${ENDPOINTS.indicators}/${encodeURIComponent(symbol)}?${query.toString()}`
    )
  } catch {
    return unavailableIndicators(symbol, timeframe, 'BACKEND_UNAVAILABLE')
  }
}

export async function calculateIndicators(
  payload: IndicatorCalculatePayload
): Promise<IndicatorResultsResponse> {
  try {
    return await request<IndicatorResultsResponse>(`${ENDPOINTS.indicators}/calculate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return unavailableIndicators(undefined, undefined, 'BACKEND_UNAVAILABLE')
  }
}

// ----- Strategies -----
const unavailableStrategyStatus: StrategyStatus = {
  available: false,
  engine: 'python',
  live_execution_enabled: false,
  templates_count: 0,
  supported_strategies: [],
  backtesting_enabled: false,
}

const emptyMetrics = {
  total_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  win_rate: 0,
  gross_pnl: 0,
  net_pnl: 0,
  total_fees: 0,
  total_slippage: 0,
  total_return_pct: 0,
  max_drawdown: 0,
  profit_factor: null,
  average_win: null,
  average_loss: null,
}

export async function getStrategyStatus(): Promise<StrategyStatus> {
  try {
    return await request<StrategyStatus>(ENDPOINTS.strategyStatus)
  } catch {
    return unavailableStrategyStatus
  }
}

export async function getStrategyTemplates(): Promise<StrategyTemplate[]> {
  try {
    const data = await request<{ templates?: StrategyTemplate[] }>(ENDPOINTS.strategyTemplates)
    return data.templates || []
  } catch {
    return []
  }
}

export async function runStrategyBacktest(
  payload: StrategyConfig
): Promise<BacktestResult> {
  try {
    return await request<BacktestResult>(ENDPOINTS.strategyBacktest, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return unavailableBacktestResult(payload, 'BACKEND_UNAVAILABLE')
  }
}

export async function getStrategySignalPreview(
  payload: Pick<StrategyConfig, 'strategy_name' | 'symbol' | 'timeframe' | 'params'>
): Promise<{ strategy_name: string; symbol: string; timeframe: string; signals: StrategySignal[]; count: number }> {
  try {
    return await request<{ strategy_name: string; symbol: string; timeframe: string; signals: StrategySignal[]; count: number }>(
      ENDPOINTS.strategySignalPreview,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
  } catch {
    return {
      strategy_name: payload.strategy_name,
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      signals: [],
      count: 0,
    }
  }
}

// ----- Discovery -----
const emptyBoard: DiscoveryBoard = {
  summary: {
    total_symbols_tracked: 0,
    symbols_with_data: 0,
    symbols_stale: 0,
    last_updated: null,
    note: 'Discovery backend unavailable',
  },
  gainers: [],
  losers: [],
  most_active: [],
  note: 'Discovery backend unavailable',
}

const emptyScreenerResult: ScreenerResult = {
  filters_applied: {},
  timeframe: '1m',
  symbols_evaluated: 0,
  symbols_passed: 0,
  results: [],
  note: 'Screener unavailable',
  evaluated_at: '',
}

export async function getDiscoveryBoard(): Promise<DiscoveryBoard> {
  try {
    return await request<DiscoveryBoard>('/discovery/board')
  } catch {
    return emptyBoard
  }
}

export async function getGainers(limit: number): Promise<MarketMover[]> {
  try {
    const data = await request<{ gainers?: MarketMover[] }>(`/discovery/gainers?limit=${limit}`)
    return data.gainers || []
  } catch {
    return []
  }
}

export async function getLosers(limit: number): Promise<MarketMover[]> {
  try {
    const data = await request<{ losers?: MarketMover[] }>(`/discovery/losers?limit=${limit}`)
    return data.losers || []
  } catch {
    return []
  }
}

export async function getMostActive(limit: number): Promise<MarketMover[]> {
  try {
    const data = await request<{ most_active?: MarketMover[] }>(`/discovery/most-active?limit=${limit}`)
    return data.most_active || []
  } catch {
    return []
  }
}

export async function getSectors(): Promise<string[]> {
  try {
    const data = await request<{ sectors?: string[] }>('/discovery/sectors')
    return data.sectors || []
  } catch {
    return []
  }
}

export async function getSectorInstruments(sector: string): Promise<Instrument[]> {
  try {
    const data = await request<PaginatedInstruments>(
      `/discovery/sector/${encodeURIComponent(sector)}?page=1&page_size=50`
    )
    return data.instruments || []
  } catch {
    return []
  }
}

export async function runScreener(
  filters: ScreenerFilters,
  timeframe: string,
  limit: number
): Promise<ScreenerResult> {
  try {
    return await request<ScreenerResult>('/discovery/screener', {
      method: 'POST',
      body: JSON.stringify({ filters, timeframe, limit }),
    })
  } catch {
    return { ...emptyScreenerResult, filters_applied: filters, timeframe }
  }
}

export async function getDiscoveryStatus(): Promise<DiscoveryStatus> {
  try {
    return await request<DiscoveryStatus>('/discovery/status')
  } catch {
    return {
      instrument_count: 0,
      sectors_available: 0,
      symbols_in_market_watch: 0,
      symbols_with_candle_data: 0,
      screener_available: false,
      board_available: false,
      instrument_master_source: 'unavailable',
      note: 'Discovery backend unavailable',
    }
  }
}

export async function getInstrumentsPaginated(
  page: number,
  pageSize: number,
  q?: string
): Promise<PaginatedInstruments> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (q?.trim()) params.set('q', q.trim())
  try {
    return await request<PaginatedInstruments>(`/discovery/instruments?${params.toString()}`)
  } catch {
    return { instruments: [], page, page_size: pageSize, total: 0, total_pages: 1 }
  }
}

// ----- Portfolio -----
const unavailablePortfolioSummary: PortfolioSummary = {
  realized_pnl: null,
  unrealized_pnl: null,
  gross_pnl: null,
  total_fees: null,
  net_pnl: null,
  open_positions_count: 0,
  total_open_notional: null,
  equity: null,
  current_drawdown: null,
  max_drawdown: null,
  data_status: 'UNAVAILABLE',
}

const unavailableReconciliation: ReconciliationStatus = {
  positions: [],
  holdings: [],
  summary: { mismatch_count: 0, by_severity: {}, ok: true },
  data_status: 'UNAVAILABLE',
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    const data = await request<Partial<PortfolioSummary>>(ENDPOINTS.portfolioSummary)
    return {
      ...unavailablePortfolioSummary,
      ...data,
      data_status: 'AVAILABLE',
    }
  } catch {
    return unavailablePortfolioSummary
  }
}

export async function getPortfolioPositions(): Promise<PortfolioPosition[]> {
  try {
    const data = await request<{ positions?: Array<Record<string, unknown>> }>(
      ENDPOINTS.portfolioPositions
    )
    return (data.positions || []).map(normalizePosition)
  } catch {
    return []
  }
}

export async function getPortfolioHoldings(): Promise<PortfolioHolding[]> {
  try {
    const data = await request<{ holdings?: Array<Record<string, unknown>> }>(
      ENDPOINTS.portfolioHoldings
    )
    return (data.holdings || []).map(normalizeHolding)
  } catch {
    return []
  }
}

export async function getPortfolioEquityCurve(): Promise<EquityCurvePoint[]> {
  try {
    const data = await request<{ points?: EquityCurvePoint[] }>(
      ENDPOINTS.portfolioEquityCurve
    )
    return data.points || []
  } catch {
    return []
  }
}

export async function getPortfolioReconciliationStatus(): Promise<ReconciliationStatus> {
  try {
    const data = await request<Partial<ReconciliationStatus>>(
      ENDPOINTS.portfolioReconciliation
    )
    return {
      positions: data.positions || [],
      holdings: data.holdings || [],
      summary: data.summary || unavailableReconciliation.summary,
      data_status: 'AVAILABLE',
    }
  } catch {
    return unavailableReconciliation
  }
}

function normalizePosition(raw: Record<string, unknown>): PortfolioPosition {
  const quantity = numberOrZero(raw.quantity)
  const avgPrice = numberOrNull(raw.avg_price)
  const ltp = numberOrNull(raw.ltp)
  const marketValue = numberOrNull(raw.market_value)
  const fees = numberOrNull(raw.fees)
  const realized = numberOrNull(raw.realized_pnl)
  const unrealized = numberOrNull(raw.unrealized_pnl)
  return {
    symbol: String(raw.symbol || ''),
    quantity,
    avg_price: avgPrice,
    ltp,
    realized_pnl: realized,
    unrealized_pnl: unrealized,
    gross_pnl: addNullable(realized, unrealized),
    fees,
    net_pnl: subtractNullable(addNullable(realized, unrealized), fees),
    open_notional: marketValue,
    market_value: marketValue,
    last_update: typeof raw.last_update === 'string' ? raw.last_update : null,
    quality: ltp == null ? 'UNAVAILABLE' : 'LIVE',
  }
}

function normalizeHolding(raw: Record<string, unknown>): PortfolioHolding {
  const quantity = numberOrZero(raw.quantity)
  const averagePrice = numberOrNull(raw.average_price ?? raw.avg_price)
  const ltp = numberOrNull(raw.ltp)
  const value = numberOrNull(raw.value ?? raw.market_value)
  const pnl =
    ltp != null && averagePrice != null
      ? (ltp - averagePrice) * quantity
      : null
  return {
    symbol: String(raw.symbol || ''),
    quantity,
    average_price: averagePrice,
    ltp,
    value,
    pnl,
    data_status: 'AVAILABLE',
    last_update: typeof raw.last_update === 'string' ? raw.last_update : null,
  }
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null
  return (a ?? 0) + (b ?? 0)
}

function subtractNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null
  return (a ?? 0) - (b ?? 0)
}

function unavailableIndicators(
  symbol?: string,
  timeframe?: string,
  reason = 'UNAVAILABLE'
): IndicatorResultsResponse {
  return {
    symbol,
    timeframe,
    engine: 'python',
    available: false,
    reason,
    count: 0,
    results: {},
  }
}

function unavailableBacktestResult(payload: StrategyConfig, reason: string): BacktestResult {
  return {
    status: 'ERROR',
    strategy_name: payload.strategy_name,
    symbol: payload.symbol,
    timeframe: payload.timeframe,
    engine: 'python',
    candles_used: 0,
    signals: [],
    trades: [],
    equity_curve: [],
    metrics: emptyMetrics,
    reason,
  }
}
