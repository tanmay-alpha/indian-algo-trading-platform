'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart2,
  ChevronDown,
  ExternalLink,
  ListChecks,
  PanelRightOpen,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { ChartFrame } from '@/components/ui-maet/chart-frame'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { MobileActionSheet } from '@/components/mobile/mobile-action-sheet'
import { MobilePage } from '@/components/mobile/mobile-page'
import { OrderTicket } from '@/components/screens/order-ticket'
import { IndicatorChartShell } from '@/components/chart/indicator-chart-shell'
import { RsiPanel } from '@/components/chart/rsi-panel'
import { MacdPanel } from '@/components/chart/macd-panel'
import { StatusOrb } from '@/components/effects/status-orb'
import { mapLineSeries, mapMacdSeries } from '@/lib/indicator-series'
import { getAngelOneChartUrl, getTradingViewChartUrl } from '@/lib/symbol-links'
import { cn } from '@/lib/utils'
import type { Timeframe } from '@/lib/types'
import { indicatorKey, useTerminalStore, selectActiveWatchlistSymbols } from '@/store/terminal-store'

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: 'D', value: '1d' },
  { label: 'W', value: '1w' },
]

export function ChartScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [orderSheetOpen, setOrderSheetOpen] = useState(false)

  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const selectedExchange = useTerminalStore((s) => s.selectedExchange)
  const selectedInstrumentName = useTerminalStore((s) => s.selectedInstrumentName)
  const setSelectedSymbol = useTerminalStore((s) => s.setSelectedSymbol)
  const marketWatch = useTerminalStore((s) => s.marketWatch)
  const activeSymbols = useTerminalStore(selectActiveWatchlistSymbols)
  const chartTimeframe = useTerminalStore((s) => s.chartTimeframe)
  const setChartTimeframe = useTerminalStore((s) => s.setChartTimeframe)
  const chartOverlays = useTerminalStore((s) => s.chartOverlays)
  const indicatorSubpanels = useTerminalStore((s) => s.indicatorSubpanels)
  const toggleChartOverlay = useTerminalStore((s) => s.toggleChartOverlay)
  const toggleIndicatorSubpanel = useTerminalStore((s) => s.toggleIndicatorSubpanel)
  const indicatorResultsByKey = useTerminalStore((s) => s.indicatorResultsBySymbolTimeframe)
  const chartCandlesByKey = useTerminalStore((s) => s.chartCandlesBySymbolTimeframe)
  const indicatorLoading = useTerminalStore((s) => s.indicatorChartLoading)
  const chartSignalMarkers = useTerminalStore((s) => s.chartSignalMarkers)
  const chartFetchDiagnostics = useTerminalStore((s) => s.chartFetchDiagnostics)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const fetchChartIndicators = useTerminalStore((s) => s.fetchChartIndicators)

  useEffect(() => {
    if (selectedSymbol) void fetchChartIndicators(selectedSymbol, chartTimeframe)
  }, [chartTimeframe, fetchChartIndicators, selectedSymbol])

  const symbolOptions = useMemo(() => {
    return Array.from(new Set([selectedSymbol, ...activeSymbols].filter(Boolean))) as string[]
  }, [activeSymbols, selectedSymbol])

  const chartKey = selectedSymbol ? indicatorKey(selectedSymbol, chartTimeframe) : null
  const indicatorResults = chartKey ? indicatorResultsByKey[chartKey] : undefined
  const candles = chartKey ? chartCandlesByKey[chartKey] || [] : []
  const rsiPoints = mapLineSeries(candles, indicatorResults?.results.rsi)
  const macdPoints = mapMacdSeries(candles, indicatorResults?.results.macd)
  const row = selectedSymbol ? marketWatch[selectedSymbol] : null
  const cleanSymbol = selectedSymbol?.split(':').pop()?.replace(/-EQ$/, '') ?? selectedSymbol
  const displayExchange = selectedExchange ?? row?.exchange ?? 'NSE'
  const displayName = selectedInstrumentName ?? row?.name ?? 'Select from watchlist'
  const tvUrl = selectedSymbol ? getTradingViewChartUrl(selectedSymbol, displayExchange) : '#'
  const aoUrl = selectedSymbol ? getAngelOneChartUrl(selectedSymbol, displayExchange) : '#'
  const ltp = row?.ltp ?? null
  const changePct = row?.change_pct ?? null
  const hasLiveQuote = ltp != null && row?.stale !== true
  const candleLabel = candles.length > 0 ? `${candles.length} candles` : indicatorLoading ? 'Fetching candles' : 'No candles'

  return (
    <MobilePage className="flex h-full min-h-0 flex-col gap-3 pb-4 lg:pb-0">
      <div className="maet-glass-strong shrink-0 overflow-hidden">
        <div className="grid gap-3 border-b border-white/10 p-3 xl:grid-cols-[minmax(220px,0.7fr)_minmax(0,1fr)_auto] xl:items-center">
          <label className="relative min-w-0">
            <span className="sr-only">Select chart symbol</span>
            <select
              value={selectedSymbol ?? ''}
              onChange={(event) => setSelectedSymbol(event.target.value || null)}
              className="maet-input h-11 appearance-none pr-10 font-mono font-extrabold"
            >
              <option value="">Choose symbol</option>
              {symbolOptions.map((symbol) => (
                <option key={symbol} value={symbol}>{symbol.replace(/-EQ$/, '')}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-maet-text-muted" />
          </label>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-extrabold text-maet-text">{cleanSymbol ?? 'Choose a symbol'}</h1>
              <span className="rounded-full border border-white/10 bg-maet-glass-bg px-2.5 py-1 text-xs font-bold text-maet-text-muted">{displayExchange}</span>
              <StatusBadge tone={candles.length > 0 ? 'success' : 'warning'} dot>
                {candleLabel}
              </StatusBadge>
            </div>
            <div className="mt-1 truncate text-sm text-maet-text-muted">{displayName}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Metric label="LTP" value={hasLiveQuote ? formatPrice(ltp) : '--'} />
            <Metric
              label="Change"
              value={changePct == null || !hasLiveQuote ? '--' : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
              tone={changePct == null || !hasLiveQuote ? 'muted' : changePct >= 0 ? 'up' : 'down'}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {TIMEFRAMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setChartTimeframe(item.value)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-3 font-mono text-xs font-extrabold transition-colors',
                  chartTimeframe === item.value
                    ? 'border-maet-cyan/50 bg-maet-cyan/20 text-maet-cyan'
                    : 'border-white/10 bg-maet-glass-bg text-maet-text-muted hover:text-maet-text'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <ExternalButton href={tvUrl} disabled={!selectedSymbol} label="TradingView" />
          <ExternalButton href={aoUrl} disabled={!selectedSymbol} label="Angel One" />
          <button
            type="button"
            onClick={() => setDrawerOpen((current) => !current)}
            className="glass-button h-9 min-h-9 px-3 text-xs"
            aria-expanded={drawerOpen}
            aria-label="Toggle indicator workbench"
          >
            <PanelRightOpen className="h-4 w-4" />
            Indicators
          </button>
        </div>
      </div>

      <ChartFrame className="flex min-h-[360px] flex-1 flex-col lg:min-h-0">
        {selectedSymbol ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              {candles.length === 0 ? (
                <OfflineChartState
                  symbol={cleanSymbol ?? selectedSymbol}
                  exchange={displayExchange}
                  timeframe={chartTimeframe}
                  apiStatus={apiStatus}
                  diagnostics={chartFetchDiagnostics}
                  tradingViewUrl={tvUrl}
                  angelOneUrl={aoUrl}
                  isFetching={indicatorLoading}
                  onLoadCandles={() => void fetchChartIndicators(selectedSymbol, chartTimeframe)}
                />
              ) : (
                <IndicatorChartShell
                  symbol={selectedSymbol}
                  timeframe={chartTimeframe}
                  candles={candles}
                  result={indicatorResults}
                  overlays={chartOverlays}
                  signalMarkers={chartSignalMarkers}
                  apiStatus={apiStatus}
                  backendWakeState={backendWakeState}
                  isFetching={indicatorLoading}
                  onFetchCandles={() => void fetchChartIndicators(selectedSymbol, chartTimeframe)}
                />
              )}
            </div>

            {indicatorSubpanels.rsi && <RsiPanel points={rsiPoints} />}
            {indicatorSubpanels.macd && <MacdPanel points={macdPoints} />}
          </div>
        ) : (
          <div className="grid min-h-[340px] flex-1 place-items-center p-6 text-center">
            <div>
              <BarChart2 className="mx-auto h-10 w-10 text-maet-text-muted" />
              <h2 className="mt-4 font-heading text-xl font-bold text-maet-text">Choose a symbol</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-maet-text-muted">Pick an instrument from Watchlist to begin chart research and paper validation.</p>
            </div>
          </div>
        )}
      </ChartFrame>

      {drawerOpen ? (
        <IndicatorWorkbench
          overlays={chartOverlays}
          subpanels={indicatorSubpanels}
          onOverlay={toggleChartOverlay}
          onSubpanel={toggleIndicatorSubpanel}
        />
      ) : (
        <div className="maet-glass hidden shrink-0 items-center justify-between gap-3 px-3 py-1.5 lg:flex">
          <div className="flex items-center gap-2 text-sm font-semibold text-maet-text-muted">
            <SlidersHorizontal className="h-4 w-4 text-maet-cyan" />
            Indicator workbench collapsed
          </div>
          <button type="button" onClick={() => setDrawerOpen(true)} className="glass-button h-9 min-h-9 px-3 text-xs">
            Open
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => selectedSymbol && setOrderSheetOpen(true)}
        disabled={!selectedSymbol}
        className="maet-btn maet-btn-primary h-12 shrink-0 text-sm disabled:opacity-40 lg:hidden"
      >
        <ShieldCheck className="h-4 w-4" />
        Validate Dry-Run Order
      </button>

      <MobileActionSheet
        isOpen={orderSheetOpen}
        onClose={() => setOrderSheetOpen(false)}
        title={`Dry-run validation: ${cleanSymbol ?? 'Symbol'}`}
      >
        <div className="h-[64dvh] min-h-[360px]">
          <OrderTicket />
        </div>
      </MobileActionSheet>
    </MobilePage>
  )
}

function Metric({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'up' | 'down' | 'muted' }) {
  return (
    <div className="rounded-lg border border-white/10 bg-maet-ink-950/40 px-3 py-2 text-right">
      <div className="text-xs font-semibold text-maet-text-muted">{label}</div>
      <div className={cn('maet-number mt-0.5 font-mono text-sm font-extrabold', tone === 'up' ? 'text-maet-green' : tone === 'down' ? 'text-maet-red' : 'text-maet-text')}>
        {value}
      </div>
    </div>
  )
}

function ExternalButton({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-mono text-xs font-extrabold shadow-inner',
        disabled
          ? 'pointer-events-none border-white/10 text-maet-text-faint opacity-50'
          : 'border-maet-blue/40 bg-maet-blue/10 text-maet-blue-soft hover:border-maet-cyan/40 hover:text-maet-cyan'
      )}
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function OfflineChartState({
  symbol,
  exchange,
  timeframe,
  apiStatus,
  diagnostics,
  tradingViewUrl,
  angelOneUrl,
  isFetching,
  onLoadCandles,
}: {
  symbol: string
  exchange: string
  timeframe: string
  apiStatus: string
  diagnostics: {
    timeframe: string
    route: string | null
    lastFetchAt: number | null
    candleCount: number
    source: string | null
    error: string | null
  }
  tradingViewUrl: string
  angelOneUrl: string
  isFetching: boolean
  onLoadCandles: () => void
}) {
  const fetchError = diagnostics.error

  return (
    <div className="grid h-full min-h-[340px] flex-1 place-items-center bg-maet-ink-950/40 p-6 text-center" aria-label={`Price chart state for ${symbol}`}>
      <div className="maet-card max-w-lg p-5">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[var(--radius-md)] border border-[var(--border-2)] bg-[var(--bg-panel)] text-[var(--neutral)]">
          <BarChart2 className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-heading text-xl font-bold text-maet-text">No candle data for {symbol} · {timeframe}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-maet-text-muted">
          Fetch broker-backed historical candles for this selected research view.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onLoadCandles}
            disabled={isFetching}
            className="inline-flex h-10 min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--neutral)] bg-[var(--neutral-dim)] px-4 font-mono text-xs font-bold text-[var(--neutral)] transition-colors hover:bg-[rgba(56,189,248,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            {isFetching ? 'Loading...' : "Load Today's Candles"}
          </button>
          <a href={tradingViewUrl} target="_blank" rel="noopener noreferrer" className="glass-button h-10 min-h-10 px-4 text-xs">
            TradingView
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href={angelOneUrl} target="_blank" rel="noopener noreferrer" className="glass-button h-10 min-h-10 px-4 text-xs">
            Angel One
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {fetchError && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--down)] bg-[var(--down-dim)] px-3 py-2 text-left text-xs leading-5 text-[var(--down)]">
            {fetchError}
          </div>
        )}
        <details className="mt-4 rounded-lg border border-white/10 bg-maet-ink-950/56 p-3 text-left text-xs text-maet-text-muted">
          <summary className="cursor-pointer font-bold text-maet-text-soft">Data details</summary>
          <div className="mt-3 grid gap-2">
            <DiagnosticLine label="Exchange" value={exchange} />
            <DiagnosticLine label="Timeframe" value={diagnostics.timeframe} />
            <DiagnosticLine label="Last fetch" value={formatLastFetch(diagnostics.lastFetchAt)} />
            <DiagnosticLine label="Valid candles" value={String(diagnostics.candleCount)} />
            <DiagnosticLine label="Data state" value={diagnostics.source ?? apiStatus} />
            {diagnostics.error && <DiagnosticLine label="Result" value={diagnostics.error} />}
          </div>
        </details>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-maet-text-muted">
          No synthetic data is shown.
        </div>
      </div>
    </div>
  )
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
      <span>{label}</span>
      <span className="break-words font-mono text-maet-text-soft">{value}</span>
    </div>
  )
}

function formatLastFetch(value: number | null): string {
  if (!value) return 'Pending'
  return new Date(value).toLocaleTimeString()
}

function IndicatorWorkbench({
  overlays,
  subpanels,
  onOverlay,
  onSubpanel,
}: {
  overlays: { ema: boolean; vwap: boolean; bollinger_bands: boolean }
  subpanels: { rsi: boolean; macd: boolean }
  onOverlay: (name: 'ema' | 'vwap' | 'bollinger_bands') => void
  onSubpanel: (name: 'rsi' | 'macd') => void
}) {
  return (
    <aside className="maet-glass shrink-0 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-maet-violet" />
          <h2 className="font-heading text-base font-bold text-maet-text">Indicator Workbench</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-maet-text-muted">
          <StatusOrb tone="violet" />
          Overlays are research only
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <IndicatorToggle label="EMA" checked={overlays.ema} onClick={() => onOverlay('ema')} />
        <IndicatorToggle label="VWAP" checked={overlays.vwap} onClick={() => onOverlay('vwap')} />
        <IndicatorToggle label="Bollinger" checked={overlays.bollinger_bands} onClick={() => onOverlay('bollinger_bands')} />
        <IndicatorToggle label="RSI panel" checked={subpanels.rsi} onClick={() => onSubpanel('rsi')} />
        <IndicatorToggle label="MACD panel" checked={subpanels.macd} onClick={() => onSubpanel('macd')} />
        <div className="rounded-lg border border-white/10 bg-maet-ink-950/40 px-3 py-2">
          <div className="text-xs font-semibold text-maet-text-muted">EMA period</div>
          <input type="number" defaultValue={20} min={1} className="maet-input mt-1 h-9 font-mono" aria-label="EMA period" />
        </div>
      </div>
    </aside>
  )
}

function IndicatorToggle({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 w-full items-center justify-between rounded-lg border px-3 text-sm font-bold transition-colors',
        checked ? 'border-maet-violet/40 bg-maet-violet/20 text-maet-violet' : 'border-white/10 bg-maet-ink-950/40 text-maet-text-soft hover:bg-maet-glass-bg-strong hover:text-maet-text'
      )}
    >
      {label}
      <span className={cn('h-4 w-8 rounded-full border p-0.5', checked ? 'border-maet-violet/40 bg-maet-violet/20' : 'border-white/10 bg-maet-panel-soft')}>
        <span className={cn('block h-2.5 w-2.5 rounded-full bg-current transition-transform', checked && 'translate-x-4')} />
      </span>
    </button>
  )
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
