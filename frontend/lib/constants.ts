import type {
  WorkspaceId,
  PresetId,
  DockTabId,
  RightPanelTab,
  Timeframe,
} from './types'

// ----- API / WS -----
const LOCAL_API_FALLBACK = 'http://localhost:8000'
const CLOUD_API_FALLBACK = 'https://maet-backend.onrender.com'
const WS_MARKET_STREAM_PATH = '/ws/market_stream'

export const API_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL)

export const WS_URL =
  normalizeWsUrl(process.env.NEXT_PUBLIC_WS_URL, API_URL)

export const CONNECTIVITY_TARGETS = {
  api: safeApiTarget(API_URL),
  ws: safeWsTarget(WS_URL),
} as const

export const ENDPOINTS = {
  health: '/health',
  terminalStatus: '/terminal/status',
  marketWatch: '/market-watch',
  searchInstruments: '/instruments/search',
  indices: '/indices',
  candles: '/candles',
  toggleMode: '/toggle_mode',
  toggleAutoPilot: '/toggle_auto_pilot',
  order: '/order',
  portfolioSummary: '/portfolio/summary',
  portfolioPositions: '/portfolio/positions',
  portfolioHoldings: '/portfolio/holdings',
  portfolioEquityCurve: '/portfolio/equity-curve',
  portfolioReconciliation: '/portfolio/reconciliation/status',
  indicators: '/indicators',
  indicatorStatus: '/indicators/status',
  strategyStatus: '/strategies/status',
  strategyTemplates: '/strategies/templates',
  strategyBacktest: '/strategies/backtest',
  strategySignalPreview: '/strategies/signal-preview',
  // OMS (Phase 18L)
  omsHealth: '/oms/health',
  omsStatus: '/oms/status',
  omsOrdersRecent: '/oms/orders/recent',
  omsEventsRecent: '/oms/events/recent',
  omsFillsRecent: '/oms/fills/recent',
  omsOrderAudit: '/oms/orders', // + /{request_id}/audit
  omsReconciliationStatus: '/oms/reconciliation/status',
  // Manual Order Dry-run (Phase 3)
  manualOrderStatus: '/manual-order/status',
  manualOrderValidate: '/manual-order/validate',
  manualOrderTickets: '/manual-order/tickets',
} as const

export const STALE_THRESHOLD_MS = 8000
export const DELAYED_THRESHOLD_MS = 3000

// ----- Workspaces -----
export interface WorkspaceDef {
  id: WorkspaceId
  label: string
  short: string
  shortcut: string
}

export const WORKSPACES: WorkspaceDef[] = [
  { id: 'trade', label: 'Trade', short: 'TRD', shortcut: '1' },
  { id: 'markets', label: 'Markets', short: 'MKT', shortcut: '2' },
  { id: 'strategy', label: 'Strategy Lab', short: 'STR', shortcut: '3' },
  { id: 'portfolio', label: 'Portfolio', short: 'PRT', shortcut: '4' },
  { id: 'oms', label: 'OMS Blotter', short: 'OMS', shortcut: '5' },
  { id: 'journal', label: 'System Journal', short: 'SYS', shortcut: '6' },
]

// ----- Presets -----
export interface PresetDef {
  id: PresetId
  label: string
  workspace: WorkspaceId
  description: string
}

export const PRESETS: PresetDef[] = [
  {
    id: 'scalper',
    label: 'Scalper',
    workspace: 'trade',
    description: 'Watchlist + chart + order ticket; tick health visible',
  },
  {
    id: 'swing',
    label: 'Swing',
    workspace: 'trade',
    description: 'Large chart + indicators + journal context',
  },
  {
    id: 'risk-monitor',
    label: 'Risk Monitor',
    workspace: 'oms',
    description: 'Tick drop, stale data, session health, execution lock',
  },
  {
    id: 'strategy-lab',
    label: 'Strategy Lab',
    workspace: 'strategy',
    description: 'Signals feed, backtest placeholder, strategy health',
  },
  {
    id: 'market-discovery',
    label: 'Market Discovery',
    workspace: 'markets',
    description: 'Sector board, movers, search universe',
  },
  {
    id: 'portfolio-review',
    label: 'Portfolio Review',
    workspace: 'portfolio',
    description: 'Positions, holdings, PnL, exposure',
  },
]

// ----- Dock Tabs -----
export interface DockTabDef {
  id: DockTabId
  label: string
}

export const DOCK_TABS: DockTabDef[] = [
  { id: 'orders', label: 'Orders' },
  { id: 'positions', label: 'Positions' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'trades', label: 'Trades' },
  { id: 'pnl', label: 'PnL' },
  { id: 'signals', label: 'Signals' },
  { id: 'events', label: 'Events' },
  { id: 'system-health', label: 'System Health' },
]

// ----- Right Panel -----
export interface RightTabDef {
  id: RightPanelTab
  label: string
}

export const RIGHT_TABS: RightTabDef[] = [
  { id: 'order', label: 'Order' },
  { id: 'symbol', label: 'Symbol' },
  { id: 'risk', label: 'Risk' },
  { id: 'signals', label: 'Signals' },
  { id: 'notes', label: 'Notes' },
]

// ----- Timeframes -----
export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '1d']

// ----- Index strip -----
export const INDEX_TILES = [
  { symbol: 'NIFTY', label: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', label: 'NIFTY BANK' },
  { symbol: 'SENSEX', label: 'SENSEX' },
  { symbol: 'NIFTYIT', label: 'NIFTY IT' },
  { symbol: 'INDIAVIX', label: 'INDIA VIX' },
]

// ----- Watchlist groups (default) -----
export const DEFAULT_WATCHLIST_GROUPS = [
  {
    id: 'nifty50',
    name: 'Nifty 50',
    symbols: [
      'SBIN-EQ', 'RELIANCE-EQ', 'HDFCBANK-EQ', 'INFY-EQ', 'TCS-EQ',
      'ICICIBANK-EQ', 'AXISBANK-EQ', 'WIPRO-EQ', 'ITC-EQ', 'TATASTEEL-EQ',
      'KOTAKBANK-EQ', 'BAJFINANCE-EQ', 'MARUTI-EQ', 'SUNPHARMA-EQ', 'BHARTIARTL-EQ',
    ],
  },
  {
    id: 'banking',
    name: 'Banking',
    symbols: ['HDFCBANK-EQ', 'ICICIBANK-EQ', 'AXISBANK-EQ', 'KOTAKBANK-EQ', 'SBIN-EQ'],
  },
  {
    id: 'it',
    name: 'IT',
    symbols: ['TCS-EQ', 'INFY-EQ', 'WIPRO-EQ', 'HCLTECH-EQ', 'TECHM-EQ'],
  },
  {
    id: 'energy',
    name: 'Energy',
    symbols: ['RELIANCE-EQ', 'ONGC-EQ', 'NTPC-EQ', 'POWERGRID-EQ', 'COALINDIA-EQ'],
  },
  {
    id: 'auto',
    name: 'Auto',
    symbols: ['MARUTI-EQ', 'TATAMOTORS-EQ', 'BAJAJ-AUTO-EQ', 'M&M-EQ'],
  },
  {
    id: 'pharma',
    name: 'Pharma',
    symbols: ['SUNPHARMA-EQ', 'DRREDDY-EQ', 'CIPLA-EQ'],
  },
  {
    id: 'fmcg',
    name: 'FMCG',
    symbols: ['ITC-EQ', 'HINDUNILVR-EQ', 'NESTLEIND-EQ'],
  },
  {
    id: 'metals',
    name: 'Metals',
    symbols: ['TATASTEEL-EQ', 'HINDALCO-EQ', 'JSWSTEEL-EQ'],
  },
  {
    id: 'mine',
    name: 'My List',
    symbols: [],
  },
]

// ----- Indicator placeholders -----
export const INDICATORS = [
  'VWAP',
  'EMA 9',
  'EMA 21',
  'RSI',
  'MACD',
  'Bollinger Bands',
] as const

export const PATTERNS = [
  'Doji',
  'Hammer',
  'Engulfing',
  'Shooting Star',
  'Morning Star',
  'Evening Star',
] as const

// ----- Operator components in top bar -----
export const OPERATOR_COMPONENTS = [
  { id: 'broker', label: 'BROKER' },
  { id: 'feed', label: 'FEED' },
  { id: 'ws', label: 'WS' },
  { id: 'eventbus', label: 'EVT' },
  { id: 'tickbus', label: 'TICK' },
  { id: 'candles', label: 'CDL' },
  { id: 'mode-lock', label: 'LOCK' },
  { id: 'backend', label: 'API' },
] as const

// ----- Build env -----
export const BUILD_ENV =
  (process.env.NEXT_PUBLIC_BUILD_ENV as 'LOCAL' | 'CLOUD' | 'PREVIEW') ||
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
    ? 'LOCAL'
    : typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'LOCAL'
    : 'CLOUD')

function normalizeBaseUrl(value: string | undefined): string {
  const candidate = (value || runtimeDefaultApiUrl()).trim()
  try {
    const parsed = new URL(candidate)
    if (isProductionBrowser() && isLocalHost(parsed.hostname)) {
      return CLOUD_API_FALLBACK
    }
    if (isHttpsBrowser() && parsed.protocol === 'http:' && !isLocalHost(parsed.hostname)) {
      parsed.protocol = 'https:'
    }
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return runtimeDefaultApiUrl()
  }
}

function normalizeWsUrl(value: string | undefined, apiUrl: string): string {
  try {
    if (value?.trim()) {
      const explicit = new URL(value.trim())
      if (isProductionBrowser() && isLocalHost(explicit.hostname)) {
        return deriveWsUrl(apiUrl)
      }
      if (isHttpsBrowser() && explicit.protocol === 'ws:' && !isLocalHost(explicit.hostname)) {
        explicit.protocol = 'wss:'
      }
      if (!explicit.pathname || explicit.pathname === '/' || explicit.pathname === '/ws/terminal') {
        explicit.pathname = WS_MARKET_STREAM_PATH
      }
      explicit.search = ''
      return explicit.toString().replace(/\/+$/, '')
    }
    return deriveWsUrl(apiUrl)
  } catch {
    return deriveWsUrl(runtimeDefaultApiUrl())
  }
}

function deriveWsUrl(apiUrl: string): string {
  try {
    const parsed = new URL(apiUrl)
    if (isProductionBrowser() && isLocalHost(parsed.hostname)) {
      return `${CLOUD_API_FALLBACK.replace(/^https:/, 'wss:')}${WS_MARKET_STREAM_PATH}`
    }
    const protocol = parsed.protocol === 'https:' || isHttpsBrowser() ? 'wss:' : 'ws:'
    return `${protocol}//${parsed.host}${WS_MARKET_STREAM_PATH}`
  } catch {
    const fallback = runtimeDefaultApiUrl()
    return fallback.startsWith('https:')
      ? `${fallback.replace(/^https:/, 'wss:')}${WS_MARKET_STREAM_PATH}`
      : `${fallback.replace(/^http:/, 'ws:')}${WS_MARKET_STREAM_PATH}`
  }
}

function runtimeDefaultApiUrl(): string {
  return isProductionBrowser() ? CLOUD_API_FALLBACK : LOCAL_API_FALLBACK
}

function isProductionBrowser(): boolean {
  return typeof window !== 'undefined' && !isLocalHost(window.location.hostname)
}

function isHttpsBrowser(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}

function isLocalHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
}

function safeApiTarget(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return 'configured API endpoint'
  }
}

function safeWsTarget(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return 'configured WebSocket endpoint'
  }
}
