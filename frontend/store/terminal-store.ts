import { create } from 'zustand'
import type {
  WorkspaceId,
  PresetId,
  RightPanelTab,
  DockTabId,
  TickPayload,
  PortfolioPerformance,
  PortfolioSummary,
  PortfolioPosition,
  PortfolioHolding,
  EquityCurvePoint,
  ReconciliationStatus,
  BrokerStatus,
  GatewayStatus,
  TerminalStatus,
  IndexSnapshot,
  SystemEvent,
  SignalEvent,
  EventSeverity,
  Timeframe,
  DataQuality,
  MarketWatchRow,
  StatusSource,
  WsConnectionStatus,
  ApiStatus,
  BackendWakeState,
  ConnectivityDiagnostics,
  IndicatorEngineStatus,
  IndicatorName,
  IndicatorOverlayName,
  IndicatorResultsResponse,
  IndicatorSubpanelName,
  ChartOverlayState,
  IndicatorSubpanelState,
  Candle,
  StrategyStatus,
  StrategyTemplate,
  StrategyConfig,
  BacktestResult,
  StrategySignal,
  ChartSignalMarker,
  OmsHealthResponse,
  OmsStatusResponse,
  OmsOrder,
  OmsEvent,
  OmsFill,
  OrderAuditBundle,
  OmsReconciliationStatus,
  OmsDataState,
  PersistentWatchlistItem,
  PersistentWatchlist,
} from '@/lib/types'
import { uid } from '@/lib/utils'
import { DEFAULT_WATCHLIST_GROUPS } from '@/lib/constants'
import { mapSignalsToMarkers } from '@/lib/strategy-series'
import {
  getPortfolioEquityCurve,
  getPortfolioHoldings,
  getPortfolioPositions,
  getPortfolioReconciliationStatus,
  getPortfolioSummary,
  getIndicatorStatus,
  getIndicatorsForSymbol,
  fetchCandles,
  getStrategySignalPreview,
  getStrategyStatus,
  getStrategyTemplates,
  runStrategyBacktest,
  getOmsHealth,
  getOmsStatus,
  getRecentOmsOrders,
  getRecentOmsEvents,
  getRecentOmsFills,
  getOrderAudit,
  getOmsReconciliationStatus,
  getDefaultWatchlistItems,
  addWatchlistItem,
  removeWatchlistItem,
} from '@/lib/api'

export interface TerminalState {
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
  wsStatus: WsConnectionStatus
  statusSource: StatusSource
  reconnectAttempt: number
  apiStatus: ApiStatus
  backendReachable: boolean
  backendWakeState: BackendWakeState
  backendOffline: boolean
  lastStatusFetchAt: number | null
  lastStatusError: string | null
  connectionError: string | null
  connectivityDiagnostics: ConnectivityDiagnostics

  // Backend status
  terminalStatus: TerminalStatus | null
  brokerStatus: BrokerStatus | null
  portfolio: PortfolioPerformance | null
  portfolioSummary: PortfolioSummary | null
  positions: PortfolioPosition[]
  holdings: PortfolioHolding[]
  equityCurve: EquityCurvePoint[]
  reconciliationStatus: ReconciliationStatus | null
  portfolioLoading: boolean
  portfolioError: string | null
  portfolioLastUpdated: number | null
  indicatorStatus: IndicatorEngineStatus | null
  indicatorResultsBySymbolTimeframe: Record<string, IndicatorResultsResponse>
  indicatorLoading: boolean
  indicatorError: string | null
  chartOverlays: ChartOverlayState
  indicatorSubpanels: IndicatorSubpanelState
  activeIndicatorNames: IndicatorName[]
  latestIndicatorResults: IndicatorResultsResponse | null
  indicatorChartError: string | null
  indicatorChartLoading: boolean
  chartCandlesBySymbolTimeframe: Record<string, Candle[]>
  strategyStatus: StrategyStatus | null
  strategyTemplates: StrategyTemplate[]
  selectedStrategyName: string | null
  selectedStrategyParams: Record<string, number | string | boolean>
  backtestConfig: StrategyConfig
  backtestResult: BacktestResult | null
  strategySignals: StrategySignal[]
  strategyLoading: boolean
  strategyError: string | null
  strategyLastUpdated: number | null
  chartSignalMarkers: ChartSignalMarker[]

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

  // OMS / Order Blotter (Phase 18L)
  omsAdminToken: string | null       // in-memory only, never persisted
  omsHealth: OmsHealthResponse | null
  omsStatus: OmsStatusResponse | null
  recentOmsOrders: OmsOrder[]
  recentOmsEvents: OmsEvent[]
  recentOmsFills: OmsFill[]
  selectedOmsOrderAudit: OrderAuditBundle | null
  omsReconciliationStatus: OmsReconciliationStatus | null
  omsLoading: boolean
  omsError: string | null
  omsAdminRequired: boolean
  omsDataState: OmsDataState
  omsLastUpdatedAt: number | null

  // Persistent watchlist (Phase 19E)
  persistentWatchlistId: number | null
  persistentWatchlistItems: PersistentWatchlistItem[]
  watchlistSource: 'db' | 'fallback' | null
  watchlistLoading: boolean
  watchlistError: string | null
  watchlistAdminRequired: boolean
  watchlistLastUpdatedAt: number | null
}

export interface TerminalActions {
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
  setWsStatus: (status: WsConnectionStatus) => void
  setStatusSource: (source: StatusSource) => void
  setReconnectAttempt: (attempt: number) => void
  incrementReconnect: () => void
  resetReconnect: () => void
  setBackendOffline: (v: boolean) => void
  setBackendWakeState: (state: BackendWakeState) => void
  setApiReachability: (reachable: boolean, error?: string | null) => void
  setConnectionError: (e: string | null) => void
  updateConnectivityDiagnostics: (patch: Partial<ConnectivityDiagnostics>) => void

  setTerminalStatus: (s: TerminalStatus | null) => void
  ingestGatewayStatus: (s: GatewayStatus) => void
  setBrokerStatus: (s: BrokerStatus | null) => void
  setPortfolio: (p: PortfolioPerformance | null) => void
  fetchPortfolioSummary: () => Promise<void>
  fetchPositions: () => Promise<void>
  fetchHoldings: () => Promise<void>
  fetchEquityCurve: () => Promise<void>
  fetchReconciliationStatus: () => Promise<void>
  refreshPortfolio: () => Promise<void>
  fetchIndicatorStatus: () => Promise<void>
  fetchIndicatorsForSelectedSymbol: (names?: IndicatorName[]) => Promise<void>
  clearIndicatorResults: () => void
  toggleChartOverlay: (name: IndicatorOverlayName) => void
  toggleIndicatorSubpanel: (name: IndicatorSubpanelName) => void
  setIndicatorOverlays: (overlays: Partial<ChartOverlayState>, subpanels?: Partial<IndicatorSubpanelState>) => void
  fetchChartIndicators: (symbol: string, timeframe: Timeframe) => Promise<void>
  clearChartIndicators: () => void
  fetchStrategyStatus: () => Promise<void>
  fetchStrategyTemplates: () => Promise<void>
  selectStrategy: (strategyName: string) => void
  updateStrategyParam: (key: string, value: number | string | boolean) => void
  updateBacktestConfig: (patch: Partial<StrategyConfig>) => void
  runSelectedStrategyBacktest: () => Promise<void>
  fetchSignalPreview: () => Promise<void>
  clearBacktestResult: () => void
  clearStrategyError: () => void

  ingestTick: (tick: TickPayload) => void
  ingestSignal: (s: SignalEvent) => void
  ingestEvent: (e: Omit<SystemEvent, 'id' | 'ts'> & { ts?: number }) => void

  setMode: (m: 'PAPER' | 'LIVE') => void
  setAutoPilot: (v: boolean) => void

  // OMS actions (Phase 18L)
  setOmsAdminToken: (token: string | null) => void
  clearOmsAdminToken: () => void
  fetchOmsHealth: () => Promise<void>
  fetchOmsStatus: () => Promise<void>
  fetchRecentOmsOrders: () => Promise<void>
  fetchRecentOmsEvents: () => Promise<void>
  fetchRecentOmsFills: () => Promise<void>
  fetchOrderAudit: (requestId: string) => Promise<void>
  clearOrderAudit: () => void
  fetchOmsReconciliationStatus: () => Promise<void>
  refreshOmsDashboard: () => Promise<void>

  // Persistent watchlist actions (Phase 19E)
  fetchPersistentWatchlist: () => Promise<void>
  addSymbolToBackend: (symbol: string, exchange?: string) => Promise<void>
  removeSymbolFromBackend: (symbol: string) => Promise<void>
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

  watchlistGroupId: 'nifty50',
  watchlistGroups: DEFAULT_WATCHLIST_GROUPS.map((g) => ({ ...g, symbols: [...g.symbols] })),
  marketWatch: {},

  indices: [],

  wsConnected: false,
  wsReconnectAttempts: 0,
  wsStatus: 'OFFLINE',
  statusSource: 'NONE',
  reconnectAttempt: 0,
  apiStatus: 'UNKNOWN',
  backendReachable: false,
  backendWakeState: 'IDLE',
  backendOffline: false,
  lastStatusFetchAt: null,
  lastStatusError: null,
  connectionError: null,
  connectivityDiagnostics: {
    apiTarget: '',
    wsTarget: '',
    restHealthOk: null,
    restTerminalStatusOk: null,
    wsConstructorCalled: false,
    wsOpen: false,
    wsLastCloseCode: null,
    wsLastError: null,
    lastWsMessageType: null,
    updatedAt: null,
  },

  terminalStatus: null,
  brokerStatus: null,
  portfolio: null,
  portfolioSummary: null,
  positions: [],
  holdings: [],
  equityCurve: [],
  reconciliationStatus: null,
  portfolioLoading: false,
  portfolioError: null,
  portfolioLastUpdated: null,
  indicatorStatus: null,
  indicatorResultsBySymbolTimeframe: {},
  indicatorLoading: false,
  indicatorError: null,
  chartOverlays: {
    ema: false,
    vwap: false,
    bollinger_bands: false,
  },
  indicatorSubpanels: {
    rsi: false,
    macd: false,
  },
  activeIndicatorNames: [],
  latestIndicatorResults: null,
  indicatorChartError: null,
  indicatorChartLoading: false,
  chartCandlesBySymbolTimeframe: {},
  strategyStatus: null,
  strategyTemplates: [],
  selectedStrategyName: null,
  selectedStrategyParams: {},
  backtestConfig: {
    strategy_name: '',
    symbol: '',
    timeframe: '5m',
    params: {},
    initial_capital: 100000,
    quantity: 1,
    fee_bps: 3,
    slippage_bps: 2,
  },
  backtestResult: null,
  strategySignals: [],
  strategyLoading: false,
  strategyError: null,
  strategyLastUpdated: null,
  chartSignalMarkers: [],

  currentTick: null,
  lastTickAt: null,
  lastTickBySymbol: {},
  dataQualityBySymbol: {},

  executionMode: 'PAPER',
  autoPilot: false,

  events: [],
  signals: [],

  // OMS initial state
  omsAdminToken: null,
  omsHealth: null,
  omsStatus: null,
  recentOmsOrders: [],
  recentOmsEvents: [],
  recentOmsFills: [],
  selectedOmsOrderAudit: null,
  omsReconciliationStatus: null,
  omsLoading: false,
  omsError: null,
  omsAdminRequired: false,
  omsDataState: 'LOADING',
  omsLastUpdatedAt: null,

  // Persistent watchlist initial state
  persistentWatchlistId: null,
  persistentWatchlistItems: [],
  watchlistSource: null,
  watchlistLoading: false,
  watchlistError: null,
  watchlistAdminRequired: false,
  watchlistLastUpdatedAt: null,
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
  setChartTimeframe: (t) => {
    set((state) => ({
      chartTimeframe: t,
      backtestConfig: { ...state.backtestConfig, timeframe: t },
    }))
    const { selectedSymbol } = get()
    if (selectedSymbol) {
      void get().fetchChartIndicators(selectedSymbol, t)
    }
  },

  toggleCommandPalette: (open) =>
    set((s) => ({ commandPaletteOpen: open ?? !s.commandPaletteOpen })),
  toggleShortcuts: (open) =>
    set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),

  setSelectedSymbol: (s) => {
    set((state) => ({
      selectedSymbol: s,
      backtestConfig: { ...state.backtestConfig, symbol: s || '' },
    }))
    const { chartTimeframe } = get()
    if (s) {
      void get().fetchChartIndicators(s, chartTimeframe)
    }
  },

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
        wsStatus: v ? 'CONNECTED' : state.wsStatus === 'CONNECTED' ? 'OFFLINE' : state.wsStatus,
        statusSource: v ? 'WS' : state.statusSource,
        events: evt ? [evt, ...state.events].slice(0, MAX_EVENTS) : state.events,
      }
    }),

  setWsStatus: (wsStatus) =>
    set({
      wsStatus,
      wsConnected: wsStatus === 'CONNECTED',
    }),
  setStatusSource: (statusSource) => set({ statusSource }),
  setReconnectAttempt: (attempt) =>
    set({ reconnectAttempt: attempt, wsReconnectAttempts: attempt }),
  incrementReconnect: () =>
    set((s) => ({
      wsReconnectAttempts: s.wsReconnectAttempts + 1,
      reconnectAttempt: s.reconnectAttempt + 1,
    })),
  resetReconnect: () => set({ wsReconnectAttempts: 0, reconnectAttempt: 0 }),

  setBackendOffline: (v) =>
    set((state) => {
      if (v === state.backendOffline) return state
      const evt = v
        ? sysEvent('API', 'error', 'Backend HTTP unreachable')
        : sysEvent('API', 'success', 'Backend HTTP reachable')
      return {
        backendOffline: v,
        backendReachable: !v,
        apiStatus: v ? 'OFFLINE' : 'ONLINE',
        backendWakeState: v ? 'UNAVAILABLE' : 'ONLINE',
        lastStatusFetchAt: v ? state.lastStatusFetchAt : Date.now(),
        lastStatusError: v ? state.lastStatusError : null,
        events: [evt, ...state.events].slice(0, MAX_EVENTS),
      }
    }),
  setBackendWakeState: (backendWakeState) =>
    set({
      backendWakeState,
      apiStatus:
        backendWakeState === 'WAKING'
          ? 'WAKING'
          : backendWakeState === 'ONLINE'
          ? 'ONLINE'
          : backendWakeState === 'UNAVAILABLE'
          ? 'OFFLINE'
          : 'UNKNOWN',
    }),
  setApiReachability: (reachable, error = null) =>
    set((state) => ({
      backendReachable: reachable,
      backendOffline: !reachable,
      apiStatus: reachable ? 'ONLINE' : 'OFFLINE',
      backendWakeState: reachable ? 'ONLINE' : state.backendWakeState === 'WAKING' ? 'WAKING' : 'UNAVAILABLE',
      lastStatusFetchAt: reachable ? Date.now() : state.lastStatusFetchAt,
      lastStatusError: reachable ? null : error,
    })),

  setConnectionError: (e) => set({ connectionError: e }),
  updateConnectivityDiagnostics: (patch) =>
    set((state) => ({
      connectivityDiagnostics: {
        ...state.connectivityDiagnostics,
        ...patch,
        updatedAt: Date.now(),
      },
    })),

  setTerminalStatus: (s) =>
    set((state) => ({
      terminalStatus: s,
      brokerStatus: s?.broker ?? state.brokerStatus,
      portfolioSummary: s?.portfolio ?? state.portfolioSummary,
      indicatorStatus: s?.indicator_engine ?? state.indicatorStatus,
      strategyStatus: s?.strategy_engine
        ? {
            available: true,
            engine: 'python',
            live_execution_enabled: false,
            templates_count: 0,
            supported_strategies: [],
            backtesting_enabled: true,
            ...s.strategy_engine,
          }
        : state.strategyStatus,
      executionMode: s?.trading_mode ?? state.executionMode,
    })),
  ingestGatewayStatus: (gateway) =>
    set((state) => {
      const connectionState = gateway.connection_state
      const websocketStarted =
        connectionState === 'CONNECTED' ||
        connectionState === 'CONNECTING' ||
        connectionState === 'RECONNECTING'
      return {
        terminalStatus: {
          ...(state.terminalStatus ?? { app: { status: 'online' } }),
          gateway,
        },
        brokerStatus: state.brokerStatus
          ? {
              ...state.brokerStatus,
              gateway,
              websocket_started: state.brokerStatus.websocket_started || websocketStarted,
              last_error: gateway.last_error ?? state.brokerStatus.last_error,
            }
          : state.brokerStatus,
      }
    }),
  setBrokerStatus: (s) => set({ brokerStatus: s }),
  setPortfolio: (p) => set({ portfolio: p }),
  fetchPortfolioSummary: async () => {
    const summary = await getPortfolioSummary()
    set({ portfolioSummary: summary, portfolioLastUpdated: Date.now() })
  },
  fetchPositions: async () => {
    const positions = await getPortfolioPositions()
    set({ positions, portfolioLastUpdated: Date.now() })
  },
  fetchHoldings: async () => {
    const holdings = await getPortfolioHoldings()
    set({ holdings, portfolioLastUpdated: Date.now() })
  },
  fetchEquityCurve: async () => {
    const equityCurve = await getPortfolioEquityCurve()
    set({ equityCurve, portfolioLastUpdated: Date.now() })
  },
  fetchReconciliationStatus: async () => {
    const reconciliationStatus = await getPortfolioReconciliationStatus()
    set({ reconciliationStatus, portfolioLastUpdated: Date.now() })
  },
  refreshPortfolio: async () => {
    set({ portfolioLoading: true, portfolioError: null })
    try {
      const [
        portfolioSummary,
        positions,
        holdings,
        equityCurve,
        reconciliationStatus,
      ] = await Promise.all([
        getPortfolioSummary(),
        getPortfolioPositions(),
        getPortfolioHoldings(),
        getPortfolioEquityCurve(),
        getPortfolioReconciliationStatus(),
      ])
      set({
        portfolioSummary,
        positions,
        holdings,
        equityCurve,
        reconciliationStatus,
        portfolioLoading: false,
        portfolioError:
          portfolioSummary.data_status === 'UNAVAILABLE'
            ? 'Portfolio backend unavailable'
            : null,
        portfolioLastUpdated: Date.now(),
      })
    } catch {
      set({
        portfolioLoading: false,
        portfolioError: 'Portfolio backend unavailable',
        portfolioLastUpdated: Date.now(),
      })
    }
  },
  fetchIndicatorStatus: async () => {
    const indicatorStatus = await getIndicatorStatus()
    set({ indicatorStatus })
  },
  fetchIndicatorsForSelectedSymbol: async (names = ['ema', 'rsi', 'macd']) => {
    const { selectedSymbol, chartTimeframe } = get()
    if (!selectedSymbol) {
      set({ indicatorError: 'Select a symbol first' })
      return
    }
    set({ indicatorLoading: true, indicatorError: null })
    const response = await getIndicatorsForSymbol(selectedSymbol, chartTimeframe, names)
    const key = indicatorKey(selectedSymbol, chartTimeframe)
    set((state) => ({
      indicatorLoading: false,
      indicatorError:
        response.available || response.reason === 'NO_CANDLES'
          ? null
          : response.reason || 'Indicator backend unavailable',
      indicatorResultsBySymbolTimeframe: {
        ...state.indicatorResultsBySymbolTimeframe,
        [key]: response,
      },
    }))
  },
  clearIndicatorResults: () =>
    set({
      indicatorResultsBySymbolTimeframe: {},
      indicatorError: null,
    }),
  toggleChartOverlay: (name) => {
    set((state) => {
      const chartOverlays = {
        ...state.chartOverlays,
        [name]: !state.chartOverlays[name],
      }
      return {
        chartOverlays,
        activeIndicatorNames: activeNames(chartOverlays, state.indicatorSubpanels),
      }
    })
    fetchOrClearActiveIndicators(get)
  },
  toggleIndicatorSubpanel: (name) => {
    set((state) => {
      const indicatorSubpanels = {
        ...state.indicatorSubpanels,
        [name]: !state.indicatorSubpanels[name],
      }
      return {
        indicatorSubpanels,
        activeIndicatorNames: activeNames(state.chartOverlays, indicatorSubpanels),
      }
    })
    fetchOrClearActiveIndicators(get)
  },
  setIndicatorOverlays: (overlays, subpanels) => {
    set((state) => {
      const chartOverlays = { ...state.chartOverlays, ...overlays }
      const indicatorSubpanels = { ...state.indicatorSubpanels, ...(subpanels || {}) }
      return {
        chartOverlays,
        indicatorSubpanels,
        activeIndicatorNames: activeNames(chartOverlays, indicatorSubpanels),
      }
    })
    fetchOrClearActiveIndicators(get)
  },
  fetchChartIndicators: async (symbol, timeframe) => {
    const names = get().activeIndicatorNames
    if (!symbol) {
      get().clearChartIndicators()
      return
    }

    set({
      indicatorChartLoading: true,
      indicatorLoading: true,
      indicatorChartError: null,
      indicatorError: null,
    })

    const key = indicatorKey(symbol, timeframe)
    let candles: Candle[] = []
    try {
      const candleResponse = await fetchCandles(symbol, timeframe)
      candles = candleResponse.candles || []
    } catch {
      candles = []
    }

    if (names.length === 0) {
      set((state) => ({
        indicatorChartLoading: false,
        indicatorLoading: false,
        indicatorChartError: null,
        indicatorError: null,
        latestIndicatorResults: null,
        chartCandlesBySymbolTimeframe: {
          ...state.chartCandlesBySymbolTimeframe,
          [key]: candles,
        },
      }))
      return
    }

    const response = await getIndicatorsForSymbol(symbol, timeframe, names)
    const unavailable =
      !response.available && response.reason !== 'NO_CANDLES'
        ? response.reason || 'Indicator backend unavailable'
        : null

    set((state) => ({
      indicatorChartLoading: false,
      indicatorLoading: false,
      indicatorChartError: unavailable,
      indicatorError: unavailable,
      latestIndicatorResults: response,
      indicatorResultsBySymbolTimeframe: {
        ...state.indicatorResultsBySymbolTimeframe,
        [key]: response,
      },
      chartCandlesBySymbolTimeframe: {
        ...state.chartCandlesBySymbolTimeframe,
        [key]: candles,
      },
    }))
  },
  clearChartIndicators: () =>
    set({
      latestIndicatorResults: null,
      indicatorChartError: null,
      indicatorChartLoading: false,
    }),
  fetchStrategyStatus: async () => {
    const strategyStatus = await getStrategyStatus()
    set({
      strategyStatus,
      strategyError: strategyStatus.available ? null : 'Strategy backend unavailable',
      strategyLastUpdated: Date.now(),
    })
  },
  fetchStrategyTemplates: async () => {
    const strategyTemplates = await getStrategyTemplates()
    set((state) => {
      const selectedStrategyName =
        state.selectedStrategyName || strategyTemplates[0]?.strategy_name || null
      const selectedTemplate = strategyTemplates.find(
        (template) => template.strategy_name === selectedStrategyName
      )
      const selectedStrategyParams =
        state.selectedStrategyName && state.selectedStrategyName === selectedStrategyName
          ? state.selectedStrategyParams
          : defaultParamsFromTemplate(selectedTemplate)
      return {
        strategyTemplates,
        selectedStrategyName,
        selectedStrategyParams,
        backtestConfig: {
          ...state.backtestConfig,
          strategy_name: selectedStrategyName || '',
          params: selectedStrategyParams,
        },
        strategyLastUpdated: Date.now(),
      }
    })
  },
  selectStrategy: (strategyName) =>
    set((state) => {
      const template = state.strategyTemplates.find((item) => item.strategy_name === strategyName)
      const selectedStrategyParams = defaultParamsFromTemplate(template)
      return {
        selectedStrategyName: strategyName,
        selectedStrategyParams,
        backtestResult: null,
        strategySignals: [],
        chartSignalMarkers: [],
        strategyError: null,
        backtestConfig: {
          ...state.backtestConfig,
          strategy_name: strategyName,
          params: selectedStrategyParams,
        },
      }
    }),
  updateStrategyParam: (key, value) =>
    set((state) => ({
      selectedStrategyParams: {
        ...state.selectedStrategyParams,
        [key]: value,
      },
      backtestConfig: {
        ...state.backtestConfig,
        params: {
          ...state.selectedStrategyParams,
          [key]: value,
        },
      },
    })),
  updateBacktestConfig: (patch) =>
    set((state) => ({
      backtestConfig: {
        ...state.backtestConfig,
        ...patch,
      },
    })),
  runSelectedStrategyBacktest: async () => {
    const state = get()
    const config = buildStrategyConfig(state)
    if (!config.strategy_name) {
      set({ strategyError: 'Select a strategy first' })
      return
    }
    if (!config.symbol) {
      set({ strategyError: 'Select a symbol before running a backtest' })
      return
    }

    set({ strategyLoading: true, strategyError: null })
    let candles = state.chartCandlesBySymbolTimeframe[indicatorKey(config.symbol, config.timeframe as Timeframe)] || []
    try {
      const candleResponse = await fetchCandles(config.symbol, config.timeframe)
      candles = candleResponse.candles || []
    } catch {
      candles = []
    }
    const result = await runStrategyBacktest(config)
    const key = indicatorKey(config.symbol, config.timeframe as Timeframe)
    const chartSignalMarkers = mapSignalsToMarkers(candles, result.signals || [])
    set((current) => ({
      backtestConfig: config,
      backtestResult: result,
      strategySignals: result.signals || [],
      chartSignalMarkers,
      strategyLoading: false,
      strategyError:
        result.status === 'ERROR'
          ? result.reason || 'Strategy backtest failed'
          : null,
      strategyLastUpdated: Date.now(),
      chartCandlesBySymbolTimeframe: {
        ...current.chartCandlesBySymbolTimeframe,
        [key]: candles,
      },
    }))
  },
  fetchSignalPreview: async () => {
    const state = get()
    const config = buildStrategyConfig(state)
    if (!config.strategy_name || !config.symbol) {
      set({ strategyError: 'Select a strategy and symbol first' })
      return
    }
    set({ strategyLoading: true, strategyError: null })
    let candles = state.chartCandlesBySymbolTimeframe[indicatorKey(config.symbol, config.timeframe as Timeframe)] || []
    try {
      const candleResponse = await fetchCandles(config.symbol, config.timeframe)
      candles = candleResponse.candles || []
    } catch {
      candles = []
    }
    const response = await getStrategySignalPreview({
      strategy_name: config.strategy_name,
      symbol: config.symbol,
      timeframe: config.timeframe,
      params: config.params,
    })
    const key = indicatorKey(config.symbol, config.timeframe as Timeframe)
    set((current) => ({
      strategySignals: response.signals || [],
      chartSignalMarkers: mapSignalsToMarkers(candles, response.signals || []),
      strategyLoading: false,
      strategyLastUpdated: Date.now(),
      chartCandlesBySymbolTimeframe: {
        ...current.chartCandlesBySymbolTimeframe,
        [key]: candles,
      },
    }))
  },
  clearBacktestResult: () =>
    set({
      backtestResult: null,
      strategySignals: [],
      chartSignalMarkers: [],
      strategyError: null,
    }),
  clearStrategyError: () => set({ strategyError: null }),

  ingestTick: (tick) =>
    set((state) => {
      const rawSymbol = tick.symbol
      const symbol = normalizeEquitySymbol(rawSymbol)
      const ts = Date.now()
      const lastBySym = { ...state.lastTickBySymbol, [rawSymbol]: ts, [symbol]: ts }
      const qBySym = {
        ...state.dataQualityBySymbol,
        [rawSymbol]: 'LIVE' as DataQuality,
        [symbol]: 'LIVE' as DataQuality,
      }

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
        currentTick: { ...tick, symbol },
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
          `${s.action} ${s.symbol}${s.strategy_name ? ` / ${s.strategy_name}` : ''}`,
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

  // ---- OMS Actions (Phase 18L) ----
  setOmsAdminToken: (token) => set({ omsAdminToken: token, omsAdminRequired: false }),
  clearOmsAdminToken: () =>
    set({
      omsAdminToken: null,
      omsAdminRequired: false,
      omsStatus: null,
      recentOmsOrders: [],
      recentOmsEvents: [],
      recentOmsFills: [],
      selectedOmsOrderAudit: null,
      omsReconciliationStatus: null,
      omsDataState: 'ADMIN_REQUIRED',
    }),

  fetchOmsHealth: async () => {
    const result = await getOmsHealth()
    if (result.ok) {
      set({ omsHealth: result.data })
    } else if ('backendUnavailable' in result) {
      set({ omsDataState: 'BACKEND_UNAVAILABLE', omsHealth: null })
    }
  },

  fetchOmsStatus: async () => {
    const token = get().omsAdminToken
    set({ omsLoading: true, omsError: null })
    const result = await getOmsStatus(token)
    if (result.ok) {
      set({ omsStatus: result.data, omsLoading: false, omsDataState: 'ONLINE', omsAdminRequired: false })
    } else if ('adminRequired' in result) {
      set({ omsLoading: false, omsAdminRequired: true, omsDataState: 'ADMIN_REQUIRED' })
    } else if ('backendUnavailable' in result) {
      set({ omsLoading: false, omsDataState: 'BACKEND_UNAVAILABLE' })
    } else {
      set({ omsLoading: false, omsError: 'error' in result ? result.error : 'Unknown error', omsDataState: 'ERROR' })
    }
  },

  fetchRecentOmsOrders: async () => {
    const token = get().omsAdminToken
    const result = await getRecentOmsOrders(token, 50)
    if (result.ok) {
      set({ recentOmsOrders: result.data.orders, omsAdminRequired: false })
    } else if ('adminRequired' in result) {
      set({ omsAdminRequired: true, omsDataState: 'ADMIN_REQUIRED' })
    } else if ('backendUnavailable' in result) {
      set({ omsDataState: 'BACKEND_UNAVAILABLE' })
    }
  },

  fetchRecentOmsEvents: async () => {
    const token = get().omsAdminToken
    const result = await getRecentOmsEvents(token, 100)
    if (result.ok) {
      set({ recentOmsEvents: result.data.events, omsAdminRequired: false })
    } else if ('adminRequired' in result) {
      set({ omsAdminRequired: true, omsDataState: 'ADMIN_REQUIRED' })
    }
  },

  fetchRecentOmsFills: async () => {
    const token = get().omsAdminToken
    const result = await getRecentOmsFills(token, 100)
    if (result.ok) {
      set({ recentOmsFills: result.data.fills, omsAdminRequired: false })
    } else if ('adminRequired' in result) {
      set({ omsAdminRequired: true, omsDataState: 'ADMIN_REQUIRED' })
    }
  },

  fetchOrderAudit: async (requestId: string) => {
    const token = get().omsAdminToken
    set({ omsLoading: true })
    const result = await getOrderAudit(requestId, token)
    if (result.ok) {
      set({ selectedOmsOrderAudit: result.data, omsLoading: false })
    } else if ('adminRequired' in result) {
      set({ omsAdminRequired: true, omsLoading: false, omsDataState: 'ADMIN_REQUIRED' })
    } else {
      set({ omsLoading: false })
    }
  },

  clearOrderAudit: () => set({ selectedOmsOrderAudit: null }),

  fetchOmsReconciliationStatus: async () => {
    const token = get().omsAdminToken
    const result = await getOmsReconciliationStatus(token)
    if (result.ok) {
      set({ omsReconciliationStatus: result.data })
    } else if ('adminRequired' in result) {
      set({ omsAdminRequired: true, omsDataState: 'ADMIN_REQUIRED' })
    }
  },

  refreshOmsDashboard: async () => {
    set({ omsLoading: true, omsError: null })
    await Promise.allSettled([
      get().fetchOmsHealth(),
      get().fetchOmsStatus(),
      get().fetchRecentOmsOrders(),
      get().fetchRecentOmsEvents(),
      get().fetchRecentOmsFills(),
      get().fetchOmsReconciliationStatus(),
    ])
    set({ omsLoading: false, omsLastUpdatedAt: Date.now() })
  },

  // ---- Persistent Watchlist (Phase 19E) ----

  fetchPersistentWatchlist: async () => {
    set({ watchlistLoading: true, watchlistError: null })
    try {
      const data = await getDefaultWatchlistItems()
      const dbSymbols: string[] = (data.symbols || []).filter(Boolean)
      const items: PersistentWatchlistItem[] = data.items || []

      // Merge DB symbols into the active local group (union, deduplicated).
      // This populates the watchlist UI from backend on page load
      // without losing any locally added symbols.
      set((state) => {
        const { watchlistGroupId, watchlistGroups } = state
        const activeGroup = watchlistGroups.find((g) => g.id === watchlistGroupId)
        if (!activeGroup || dbSymbols.length === 0) {
          return {
            persistentWatchlistId: data.watchlist_id ?? null,
            persistentWatchlistItems: items,
            watchlistSource: 'db',
            watchlistLoading: false,
            watchlistLastUpdatedAt: Date.now(),
          }
        }
        const merged = Array.from(new Set([...activeGroup.symbols, ...dbSymbols]))
        return {
          persistentWatchlistId: data.watchlist_id ?? null,
          persistentWatchlistItems: items,
          watchlistSource: 'db',
          watchlistLoading: false,
          watchlistLastUpdatedAt: Date.now(),
          watchlistGroups: watchlistGroups.map((g) =>
            g.id === watchlistGroupId ? { ...g, symbols: merged } : g
          ),
        }
      })
    } catch {
      set({
        watchlistLoading: false,
        watchlistError: 'Backend unavailable — using local watchlist fallback.',
        watchlistSource: 'fallback',
      })
    }
  },

  addSymbolToBackend: async (symbol, exchange = 'NSE') => {
    // Always update local state immediately (existing behavior preserved)
    get().addToWatchlist(symbol)

    // Fire-and-forget backend persist — never block local UI
    const { persistentWatchlistId } = get()
    if (persistentWatchlistId == null) return

    try {
      const result = await addWatchlistItem(persistentWatchlistId, symbol, exchange)
      if (!result.ok && 'adminRequired' in result && result.adminRequired) {
        set({ watchlistAdminRequired: true })
      } else if (!result.ok && 'backendUnavailable' in result) {
        set({ watchlistError: 'Backend unavailable — symbol saved locally only.' })
      } else if (!result.ok) {
        set({ watchlistError: `Could not persist symbol: ${'error' in result ? result.error : 'unknown'}` })
      } else {
        set({ watchlistError: null, watchlistAdminRequired: false })
      }
    } catch {
      set({ watchlistError: 'Backend unavailable — symbol saved locally only.' })
    }
  },

  removeSymbolFromBackend: async (symbol) => {
    // Always update local state immediately (existing behavior preserved)
    get().removeFromWatchlist(symbol)

    // Fire-and-forget backend removal — never block local UI
    const { persistentWatchlistId } = get()
    if (persistentWatchlistId == null) return

    try {
      const result = await removeWatchlistItem(persistentWatchlistId, symbol)
      if (!result.ok && 'adminRequired' in result && result.adminRequired) {
        set({ watchlistAdminRequired: true })
      } else if (!result.ok && 'backendUnavailable' in result) {
        set({ watchlistError: 'Backend unavailable — symbol removed locally only.' })
      } else {
        set({ watchlistError: null, watchlistAdminRequired: false })
      }
    } catch {
      set({ watchlistError: 'Backend unavailable — symbol removed locally only.' })
    }
  },
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

export function indicatorKey(symbol: string, timeframe: Timeframe): string {
  return `${symbol}:${timeframe}`
}

function activeNames(
  overlays: ChartOverlayState,
  subpanels: IndicatorSubpanelState
): IndicatorName[] {
  const names: IndicatorName[] = []
  if (overlays.ema) names.push('ema')
  if (overlays.vwap) names.push('vwap')
  if (overlays.bollinger_bands) names.push('bollinger_bands')
  if (subpanels.rsi) names.push('rsi')
  if (subpanels.macd) names.push('macd')
  return names
}

function fetchOrClearActiveIndicators(get: () => TerminalStore): void {
  const { selectedSymbol, chartTimeframe } = get()
  if (!selectedSymbol) {
    get().clearChartIndicators()
    return
  }
  void get().fetchChartIndicators(selectedSymbol, chartTimeframe)
}

function defaultParamsFromTemplate(
  template?: StrategyTemplate
): Record<string, number | string | boolean> {
  if (!template) return {}
  const params: Record<string, number | string | boolean> = {}
  for (const [key, schema] of Object.entries(template.params_schema || {})) {
    if (!schema || typeof schema !== 'object') continue
    const maybeDefault = (schema as { default?: unknown }).default
    if (
      typeof maybeDefault === 'number' ||
      typeof maybeDefault === 'string' ||
      typeof maybeDefault === 'boolean'
    ) {
      params[key] = maybeDefault
    }
  }
  return params
}

function buildStrategyConfig(state: TerminalStore): StrategyConfig {
  return {
    ...state.backtestConfig,
    strategy_name: state.selectedStrategyName || state.backtestConfig.strategy_name,
    symbol: state.selectedSymbol || state.backtestConfig.symbol || '',
    timeframe: state.chartTimeframe,
    params: state.selectedStrategyParams,
  }
}

function normalizeEquitySymbol(symbol: string): string {
  const normalized = String(symbol || '').trim().toUpperCase()
  if (!normalized) return normalized
  if (normalized.includes('-')) return normalized
  return `${normalized}-EQ`
}
