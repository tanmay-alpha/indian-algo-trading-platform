import { create } from 'zustand'
import type {
  TickData,
  PortfolioPerformance,
  GatewayStatus,
  WatchlistItem,
  IndexData,
  Order,
  Position,
} from '@/lib/types'

interface TerminalState {
  // Connection
  isConnected: boolean
  connectionError: string | null
  lastUpdate: number | null
  reconnectAttempts: number

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

  // Event Logs
  logs: Array<{ timestamp: number; message: string; type: 'info' | 'success' | 'error' | 'warning' }>
}

interface TerminalActions {
  setConnected: (connected: boolean) => void
  setConnectionError: (error: string | null) => void
  incrementReconnectAttempts: () => void
  resetReconnectAttempts: () => void
  updateTick: (tick: TickData) => void
  setIndices: (indices: IndexData[]) => void
  updateWatchlistPrice: (symbol: string, price: number, change: number) => void
  addToWatchlist: (item: WatchlistItem) => void
  removeFromWatchlist: (symbol: string) => void
  setExecutionMode: (mode: 'PAPER' | 'LIVE') => void
  setAutoPilot: (enabled: boolean) => void
  setGatewayStatus: (status: GatewayStatus) => void
  addLog: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void
  reset: () => void
}

const initialState: TerminalState = {
  isConnected: false,
  connectionError: null,
  lastUpdate: null,
  reconnectAttempts: 0,
  currentTick: null,
  watchlist: [],
  indices: [],
  executionMode: 'PAPER',
  autoPilot: false,
  portfolio: null,
  orders: [],
  positions: [],
  gatewayStatus: null,
  logs: [],
}

export const useTerminalStore = create<TerminalState & TerminalActions>((set) => ({
  ...initialState,

  setConnected: (connected) =>
    set((state) => {
      if (connected && !state.isConnected) {
        return {
          isConnected: connected,
          connectionError: null,
          logs: [
            { timestamp: Date.now(), message: 'WebSocket connected', type: 'success' as const },
            ...state.logs.slice(0, 99),
          ],
        }
      }
      if (!connected && state.isConnected) {
        return {
          isConnected: connected,
          logs: [
            { timestamp: Date.now(), message: 'WebSocket disconnected', type: 'warning' as const },
            ...state.logs.slice(0, 99),
          ],
        }
      }
      return { isConnected: connected }
    }),

  setConnectionError: (error) => set({ connectionError: error }),

  incrementReconnectAttempts: () =>
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),

  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  updateTick: (tick) =>
    set((state) => ({
      currentTick: tick,
      lastUpdate: Date.now(),
      executionMode: tick.mode,
      autoPilot: tick.auto_pilot,
      portfolio: tick.portfolio,
    })),

  setIndices: (indices) => set({ indices }),

  updateWatchlistPrice: (symbol, price, change) =>
    set((state) => ({
      watchlist: state.watchlist.map((item) =>
        item.symbol === symbol
          ? { ...item, ltp: price, change, changePercent: (change / (price - change)) * 100 }
          : item
      ),
    })),

  addToWatchlist: (item) =>
    set((state) => {
      if (state.watchlist.find((w) => w.symbol === item.symbol)) {
        return state
      }
      return { watchlist: [...state.watchlist, item] }
    }),

  removeFromWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.filter((item) => item.symbol !== symbol),
    })),

  setExecutionMode: (mode) => set({ executionMode: mode }),

  setAutoPilot: (enabled) => set({ autoPilot: enabled }),

  setGatewayStatus: (status) => set({ gatewayStatus: status }),

  addLog: (message, type) =>
    set((state) => ({
      logs: [{ timestamp: Date.now(), message, type }, ...state.logs.slice(0, 99)],
    })),

  reset: () => set(initialState),
}))
