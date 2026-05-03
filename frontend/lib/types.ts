// Market Data Types
export interface TickData {
  type: 'TICK'
  symbol: string
  token: string
  price: number
  vwap?: number
  signal?: 'BUY' | 'SELL' | 'NEUTRAL'
  portfolio: PortfolioPerformance
  mode: 'PAPER' | 'LIVE'
  auto_pilot: boolean
  timestamp?: number
}

export interface PortfolioPerformance {
  unrealized_pnl: number
  realized_pnl: number
  total_trades: number
  win_rate: number
  current_capital: number
  max_drawdown: number
}

export interface GatewayStatus {
  configured: boolean
  logged_in: boolean
  feed_token_available: boolean
  websocket_started: boolean
  last_error: string | null
}

export interface HealthResponse {
  status: 'online' | 'offline'
  mode: 'PAPER' | 'LIVE'
  broker: GatewayStatus
  portfolio: PortfolioPerformance
}

export interface IndexData {
  symbol: string
  name: string
  price: number
  change: number
  change_percent: number
}

export interface Instrument {
  symbol: string
  token: string
  name: string
  exchange: string
  tradingsymbol: string
}

export interface WatchlistItem {
  symbol: string
  token: string
  name: string
  ltp: number
  change: number
  changePercent: number
  prevClose?: number
}

export interface Order {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  status: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED'
  timestamp: number
  mode: 'PAPER' | 'LIVE'
}

export interface Position {
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

export interface WebSocketMessage {
  type: 'TICK' | 'SIGNAL' | 'GATEWAY_STATUS' | 'ERROR'
  data?: TickData
  signal?: string
  status?: GatewayStatus
  error?: string
}

// Terminal Store State
export interface TerminalState {
  // Connection
  isConnected: boolean
  connectionError: string | null
  lastUpdate: number | null
  
  // Market Data
  currentTick: TickData | null
  watchlist: WatchlistItem[]
  indices: IndexData[]
  
  // Trading
  executionMode: 'PAPER' | 'LIVE'
  autoPilot: boolean
  
  // Portfolio
  portfolio: PortfolioPerformance | null
  
  // Orders & Positions
  orders: Order[]
  positions: Position[]
  
  // Gateway
  gatewayStatus: GatewayStatus | null
  
  // Actions
  setConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  updateTick: (tick: TickData) => void
  setIndices: (indices: IndexData[]) => void
  addToWatchlist: (item: WatchlistItem) => void
  removeFromWatchlist: (symbol: string) => void
  setExecutionMode: (mode: 'PAPER' | 'LIVE') => void
  setAutoPilot: (enabled: boolean) => void
  setGatewayStatus: (status: GatewayStatus) => void
  reset: () => void
}
