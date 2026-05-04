import type {
  WorkspaceId,
  PresetId,
  DockTabId,
  RightPanelTab,
  Timeframe,
} from './types'

// ----- API / WS -----
export const API_URL =
  normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:8000')

export const WS_URL =
  normalizeWsUrl(process.env.NEXT_PUBLIC_WS_URL, API_URL)

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
} as const

export const WS_RECONNECT_DELAY = 2000
export const WS_MAX_RECONNECT_ATTEMPTS = 12
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
  { id: 'charts', label: 'Charts', short: 'CHT', shortcut: '3' },
  { id: 'portfolio', label: 'Portfolio', short: 'PRT', shortcut: '4' },
  { id: 'strategy', label: 'Strategy Lab', short: 'STR', shortcut: '5' },
  { id: 'risk', label: 'Risk / System', short: 'RSK', shortcut: '6' },
  { id: 'journal', label: 'Journal', short: 'JNL', shortcut: '7' },
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
    workspace: 'charts',
    description: 'Large chart + indicators + journal context',
  },
  {
    id: 'risk-monitor',
    label: 'Risk Monitor',
    workspace: 'risk',
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
export const TIMEFRAMES: Timeframe[] = ['1m', '3m', '5m', '15m', '1h', '1d']

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
    id: 'default',
    name: 'Default',
    symbols: ['SBIN-EQ', 'RELIANCE-EQ', 'INFY-EQ', 'TCS-EQ', 'HDFCBANK-EQ'],
  },
  { id: 'banking', name: 'Banking', symbols: ['HDFCBANK-EQ', 'ICICIBANK-EQ', 'KOTAKBANK-EQ', 'AXISBANK-EQ', 'SBIN-EQ'] },
  { id: 'it', name: 'IT', symbols: ['INFY-EQ', 'TCS-EQ', 'WIPRO-EQ', 'HCLTECH-EQ', 'TECHM-EQ'] },
  { id: 'metals', name: 'Metals', symbols: ['TATASTEEL-EQ', 'JSWSTEEL-EQ', 'HINDALCO-EQ', 'VEDL-EQ'] },
  { id: 'mine', name: 'My Watchlist', symbols: [] },
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
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'LOCAL'
    : 'CLOUD')

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, '')
}

function normalizeWsUrl(value: string | undefined, apiUrl: string): string {
  if (value) return value.replace(/\/+$/, '')

  try {
    const parsed = new URL(apiUrl)
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${parsed.host}/ws/market_stream`
  } catch {
    return 'ws://localhost:8000/ws/market_stream'
  }
}
