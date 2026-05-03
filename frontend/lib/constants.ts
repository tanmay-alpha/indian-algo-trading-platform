// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/terminal'

// API Endpoints
export const ENDPOINTS = {
  health: '/health',
  terminalStatus: '/terminal/status',
  marketWatch: '/market-watch',
  searchInstruments: '/instruments/search',
  indices: '/indices',
  order: '/order',
  toggleMode: '/toggle_mode',
  toggleAutoPilot: '/toggle_auto_pilot',
} as const

// WebSocket Configuration
export const WS_RECONNECT_DELAY = 3000
export const WS_MAX_RECONNECT_ATTEMPTS = 10

// Dock Tabs
export const DOCK_TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'positions', label: 'Positions' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'trades', label: 'Trades' },
  { id: 'pnl', label: 'PnL' },
  { id: 'signals', label: 'Signals' },
  { id: 'events', label: 'Events' },
  { id: 'health', label: 'System Health' },
] as const

// Default Watchlist Symbols
export const DEFAULT_WATCHLIST = [
  { symbol: 'SBIN-EQ', token: '3045', name: 'State Bank of India' },
  { symbol: 'RELIANCE-EQ', token: '2885', name: 'Reliance Industries' },
  { symbol: 'INFY-EQ', token: '1594', name: 'Infosys' },
  { symbol: 'TCS-EQ', token: '11536', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK-EQ', token: '1333', name: 'HDFC Bank' },
] as const

// Index Symbols
export const INDEX_SYMBOLS = ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FIN SERVICE'] as const
