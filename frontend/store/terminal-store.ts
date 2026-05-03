import { create } from 'zustand'
import type {
  WorkspaceId,
  PresetId,
  RightPanelTab,
  DockTabId,
  TickPayload,
  PortfolioPerformance,
  BrokerStatus,
  TerminalStatus,
  IndexSnapshot,
  SystemEvent,
  SignalEvent,
  EventSeverity,
  Timeframe,
  DataQuality,
  MarketWatchRow,
} from '@/lib/types'
import { uid } from '@/lib/utils'
import { DEFAULT_WATCHLIST_GROUPS } from '@/lib/constants'

interface TerminalState {
  // Workspace
  activeWorkspace: WorkspaceId
  activePreset: PresetId | null
  rightPanelTab: RightPanelTab
  bottomDockTab: DockTabId
  chartTimeframe: Timeframe

  // Overlays
  commandPaletteOpen: boolean
  shortcutsOpen: boolean

  // Selection
  selectedSymbol: string | null

  // Watchlist
  watchlistGroupId: string
  watchlistGroups: { id: string; name: string; symbols: string[] }[]
  marketWatch: Record<string, MarketWatchRow>

  // Indices
  indices: IndexSnapshot[]

  // Connection
  wsConnected: boolean
  wsReconnectAttempts: number
  backendOffline: boolean
  connectionError: string | null

  // Backend status
  terminalStatus: TerminalStatus | null
  brokerStatus: BrokerStatus | null
  portfolio: PortfolioPerformance | null

  // Live tick
  currentTick: TickPayload | null
  lastTickAt: number | null
  lastTickBySymbol: Record<string, number>
  dataQualityBySymbol: Record<string, DataQuality>

  // Mode
  executionMode: 'PAPER' | 'LIVE'
  autoPilot: boolean

  // Events / signals (most recent first)
  events: SystemEvent[]
  signals: SignalEvent[]
}

interface TerminalActions {
  setWorkspace: (w: WorkspaceId) => void
  setPreset: (p: PresetId | null) => void
  setRightPanelTab: (t: RightPanelTab) => void
  setBottomDockTab: (t: DockTabId) => void
  setChartTimeframe: (t: Timeframe) => void

  toggleCommandPalette: (open?: boolean) => void
  toggleShortcuts: (open?: boolean) => void

  setSelectedSymbol: (s: string | null) => void

  setWatchlistGroup: (id: string) => void
  addToWatchlist: (symbol: string) => void
  removeFromWatchlist: (symbol: string) => void
  ingestMarketWatchRows: (rows: MarketWatchRow[]) => void

  setIndices: (idx: IndexSnapshot[]) => void

  setWsConnected: (v: boolean) => void
  incrementReconnect: () => void
  resetReconnect: () => void
  setBackendOffline: (v: boolean) => void
  setConnectionError: (e: string | null) => void

  setTerminalStatus: (s: TerminalStatus | null) => void
  setBrokerStatus: (s: BrokerStatus | null) => void
  setPortfolio: (p: PortfolioPerformance | null) => void

  ingestTick: (tick: TickPayload) => void
  ingestSignal: (s: SignalEvent) => void
  ingestEvent: (e: Omit<SystemEvent, 'id' | 'ts'> & { ts?: number }) => void

  setMode: (m: 'PAPER' | 'LIVE') => void
  setAutoPilot: (v: boolean) => void
}

export type TerminalStore = TerminalState & TerminalActions

const initialState: TerminalState = {
  activeWorkspace: 'trade',
  activePreset: null,
  rightPanelTab: 'order',
  bottomDockTab: 'orders',
  chartTimeframe: '5m',

  commandPaletteOpen: false,
  shortcutsOpen: false,

  selectedSymbol: null,

  watchlistGroupId: 'default',
  watchlistGroups: DEFAULT_WATCHLIST_GROUPS.map((g) => ({ ...g, symbols: [...g.symbols] })),
  marketWatch: {},

  indices: [],

  wsConnected: false,
  wsReconnectAttempts: 0,
  backendOffline: false,
  connectionError: null,

  terminalStatus: null,
  brokerStatus: null,
  portfolio: null,

  currentTick: null,
  lastTickAt: null,
  lastTickBySymbol: {},
  dataQualityBySymbol: {},

  executionMode: 'PAPER',
  autoPilot: false,

  events: [],
  signals: [],
}

const MAX_EVENTS = 200
const MAX_SIGNALS = 100

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  ...initialState,

  setWorkspace: (w) => set({ activeWorkspace: w }),
  setPreset: (p) =>
    set((s) => {
      if (!p) return { activePreset: null }
      const target = p
      // Preset implies workspace; rely on PRESETS map for navigation
      // (kept loose to avoid coupling)
      return { activePreset: target, activeWorkspace: workspaceForPreset(target) ?? s.activeWorkspace }
    }),

  setRightPanelTab: (t) => set({ rightPanelTab: t }),
  setBottomDockTab: (t) => set({ bottomDockTab: t }),
  setChartTimeframe: (t) => set({ chartTimeframe: t }),

  toggleCommandPalette: (open) =>
    set((s) => ({ commandPaletteOpen: open ?? !s.commandPaletteOpen })),
  toggleShortcuts: (open) =>
    set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),

  setSelectedSymbol: (s) => set({ selectedSymbol: s }),

  setWatchlistGroup: (id) => set({ watchlistGroupId: id }),

  addToWatchlist: (symbol) =>
    set((state) => {
      const group = state.watchlistGroups.find((g) => g.id === state.watchlistGroupId)
      if (!group) return state
      if (group.symbols.includes(symbol)) return state
      return {
        watchlistGroups: state.watchlistGroups.map((g) =>
          g.id === state.watchlistGroupId
            ? { ...g, symbols: [...g.symbols, symbol] }
            : g
        ),
      }
    }),

  removeFromWatchlist: (symbol) =>
    set((state) => ({
      watchlistGroups: state.watchlistGroups.map((g) =>
        g.id === state.watchlistGroupId
          ? { ...g, symbols: g.symbols.filter((s) => s !== symbol) }
          : g
      ),
    })),

  ingestMarketWatchRows: (rows) =>
    set((state) => {
      const map = { ...state.marketWatch }
      for (const r of rows) {
        if (!r.symbol) continue
        map[r.symbol] = { ...map[r.symbol], ...r }
      }
      return { marketWatch: map }
    }),

  setIndices: (indices) => set({ indices }),

  setWsConnected: (v) =>
    set((state) => {
      const evt: SystemEvent | null = v && !state.wsConnected
        ? sysEvent('WS', 'success', 'WebSocket connected')
        : !v && state.wsConnected
        ? sysEvent('WS', 'warning', 'WebSocket disconnected')
        : null
      return {
        wsConnected: v,
        events: evt ? [evt, ...state.events].slice(0, MAX_EVENTS) : state.events,
      }
    }),

  incrementReconnect: () =>
    set((s) => ({ wsReconnectAttempts: s.wsReconnectAttempts + 1 })),
  resetReconnect: () => set({ wsReconnectAttempts: 0 }),

  setBackendOffline: (v) =>
    set((state) => {
      if (v === state.backendOffline) return state
      const evt = v
        ? sysEvent('API', 'error', 'Backend HTTP unreachable')
        : sysEvent('API', 'success', 'Backend HTTP reachable')
      return {
        backendOffline: v,
        events: [evt, ...state.events].slice(0, MAX_EVENTS),
      }
    }),

  setConnectionError: (e) => set({ connectionError: e }),

  setTerminalStatus: (s) => set({ terminalStatus: s }),
  setBrokerStatus: (s) => set({ brokerStatus: s }),
  setPortfolio: (p) => set({ portfolio: p }),

  ingestTick: (tick) =>
    set((state) => {
      const symbol = tick.symbol
      const ts = Date.now()
      const lastBySym = { ...state.lastTickBySymbol, [symbol]: ts }
      const qBySym = { ...state.dataQualityBySymbol, [symbol]: 'LIVE' as DataQuality }

      // Update market-watch row
      const ltp = tick.ltp ?? tick.price ?? null
      const existing = state.marketWatch[symbol] || ({ symbol } as MarketWatchRow)
      const prev = existing.ltp ?? null
      const change =
        existing.previous_ltp != null && ltp != null
          ? ltp - existing.previous_ltp
          : existing.change ?? null
      const changePct =
        existing.previous_ltp != null && ltp != null && existing.previous_ltp !== 0
          ? ((ltp - existing.previous_ltp) / existing.previous_ltp) * 100
          : existing.change_pct ?? null

      const updatedRow: MarketWatchRow = {
        ...existing,
        symbol,
        token: tick.token ?? existing.token,
        exchange: tick.exchange ?? existing.exchange,
        ltp,
        previous_ltp: prev ?? existing.previous_ltp,
        change,
        change_pct: changePct,
        best_bid: tick.best_bid ?? existing.best_bid,
        best_ask: tick.best_ask ?? existing.best_ask,
        spread: tick.spread ?? existing.spread,
        vwap: tick.vwap ?? existing.vwap,
        volume: tick.volume ?? existing.volume,
        last_update: tick.exchange_timestamp ?? new Date().toISOString(),
        stale: false,
        quality: 'LIVE',
      }

      return {
        currentTick: tick,
        lastTickAt: ts,
        lastTickBySymbol: lastBySym,
        dataQualityBySymbol: qBySym,
        marketWatch: { ...state.marketWatch, [symbol]: updatedRow },
        executionMode: tick.mode ?? state.executionMode,
        autoPilot: tick.auto_pilot ?? state.autoPilot,
        portfolio: tick.portfolio ?? state.portfolio,
        selectedSymbol: state.selectedSymbol ?? symbol,
      }
    }),

  ingestSignal: (s) =>
    set((state) => ({
      signals: [{ ...s, ts: s.ts ?? Date.now() }, ...state.signals].slice(0, MAX_SIGNALS),
      events: [
        sysEvent(
          'STRATEGY',
          'info',
          `${s.action} ${s.symbol}${s.strategy_name ? ` · ${s.strategy_name}` : ''}`,
          s.symbol
        ),
        ...state.events,
      ].slice(0, MAX_EVENTS),
    })),

  ingestEvent: (e) =>
    set((state) => ({
      events: [
        {
          id: uid('evt-'),
          ts: e.ts ?? Date.now(),
          event_type: e.event_type,
          component: e.component,
          severity: e.severity,
          message: e.message,
          symbol: e.symbol,
          payload: e.payload,
          quality: e.quality,
        },
        ...state.events,
      ].slice(0, MAX_EVENTS),
    })),

  setMode: (m) => set({ executionMode: m }),
  setAutoPilot: (v) => set({ autoPilot: v }),
}))

// ---------- helpers ----------
function sysEvent(
  component: string,
  severity: EventSeverity,
  message: string,
  symbol?: string
): SystemEvent {
  return {
    id: uid('evt-'),
    ts: Date.now(),
    event_type: 'log',
    component,
    severity,
    message,
    symbol,
  }
}

function workspaceForPreset(p: PresetId): WorkspaceId | null {
  switch (p) {
    case 'scalper':
      return 'trade'
    case 'swing':
      return 'charts'
    case 'risk-monitor':
      return 'risk'
    case 'strategy-lab':
      return 'strategy'
    case 'market-discovery':
      return 'markets'
    case 'portfolio-review':
      return 'portfolio'
    default:
      return null
  }
}

// Convenience selector helpers for components
export function selectActiveWatchlistSymbols(s: TerminalStore): string[] {
  const g = s.watchlistGroups.find((g) => g.id === s.watchlistGroupId)
  return g ? g.symbols : []
}

// Re-export so consumers don't need to import the helper directly
export const _internal = { sysEvent, workspaceForPreset }
