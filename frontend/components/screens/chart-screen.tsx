'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart2, ChevronDown, ExternalLink, ListChecks, PanelRightOpen, ShieldCheck } from 'lucide-react'
import { ChartFrame } from '@/components/ui-maet/chart-frame'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { MobileActionSheet } from '@/components/mobile/mobile-action-sheet'
import { MobilePage } from '@/components/mobile/mobile-page'
import { OrderTicket } from '@/components/screens/order-ticket'
import { IndicatorChartShell } from '@/components/chart/indicator-chart-shell'
import { RsiPanel } from '@/components/chart/rsi-panel'
import { MacdPanel } from '@/components/chart/macd-panel'
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

  return (
    <MobilePage className="flex h-full flex-col space-y-3 pb-4">
      <div className="reflection-card shrink-0 overflow-hidden">
        <div className="flex min-h-10 items-center gap-2 border-b border-maet-glass-border px-2 py-2">
          <label className="relative min-w-[144px] flex-1 sm:max-w-[220px]">
            <span className="sr-only">Select chart symbol</span>
            <select
              value={selectedSymbol ?? ''}
              onChange={(event) => setSelectedSymbol(event.target.value || null)}
              className="h-9 w-full appearance-none rounded-xl border border-maet-glass-border bg-maet-bg-deep/48 px-3 pr-8 font-mono text-sm font-bold text-maet-text"
            >
              <option value="">Select symbol</option>
              {symbolOptions.map((symbol) => (
                <option key={symbol} value={symbol}>{symbol.replace(/-EQ$/, '')}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-maet-text-muted" />
          </label>

          <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {TIMEFRAMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setChartTimeframe(item.value)}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-2.5 font-mono text-[11px] font-bold transition-colors',
                  chartTimeframe === item.value
                    ? 'border-maet-blue bg-maet-blue/20 text-maet-blue'
                    : 'border-maet-border text-maet-text-muted hover:bg-maet-elevated hover:text-maet-text'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen((current) => !current)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-maet-glass-border bg-maet-glass-1 text-maet-text-secondary hover:bg-maet-glass-2 hover:text-maet-text"
            aria-label="Toggle indicator drawer"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <StatusBadge tone={apiStatus === 'ONLINE' ? 'success' : 'warning'} dot>{apiStatus === 'ONLINE' ? 'Backend online' : 'Backend offline'}</StatusBadge>
          <a
            href={selectedSymbol ? tvUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!selectedSymbol}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] font-bold shadow-inner', selectedSymbol ? 'border-[#2962ff]/40 bg-[#2962ff]/10 text-[#7ca0ff]' : 'pointer-events-none border-maet-border text-maet-text-muted opacity-50')}
          >
            TradingView
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={selectedSymbol ? aoUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!selectedSymbol}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] font-bold shadow-inner', selectedSymbol ? 'border-[#f05822]/40 bg-[#f05822]/10 text-[#ff8b61]' : 'pointer-events-none border-maet-border text-maet-text-muted opacity-50')}
          >
            Angel One
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="font-mono text-[11px] text-maet-text-muted">(Paper research only)</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <ChartFrame className="flex min-h-[360px] flex-col">
          {selectedSymbol ? (
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-maet-glass-border px-4 py-3">
                <div>
                  <div className="font-mono text-lg font-extrabold text-maet-text">{cleanSymbol}</div>
                  <div className="text-xs text-maet-text-muted">{displayExchange} / {displayName}</div>
                </div>
                <StatusBadge tone={candles.length > 0 ? 'success' : 'warning'}>
                  {candles.length > 0 ? `${candles.length} candles` : 'Awaiting candles'}
                </StatusBadge>
              </div>

              <div className="relative min-h-0 flex-1">
                {candles.length === 0 && !indicatorLoading ? (
                  <OfflineChartState
                    symbol={cleanSymbol ?? selectedSymbol}
                    exchange={displayExchange}
                    apiStatus={apiStatus}
                    diagnostics={chartFetchDiagnostics}
                    onRetry={() => void fetchChartIndicators(selectedSymbol, chartTimeframe)}
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
            <div className="grid min-h-[340px] place-items-center p-6 text-center">
              <div>
                <BarChart2 className="mx-auto h-10 w-10 text-maet-text-muted" />
                <h2 className="mt-4 font-heading text-lg font-bold text-maet-text-secondary">Select a symbol</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-maet-text-muted">Open the watchlist and choose an instrument to load candles and indicators.</p>
              </div>
            </div>
          )}
        </ChartFrame>

        <IndicatorDrawer
          open={drawerOpen}
          overlays={chartOverlays}
          subpanels={indicatorSubpanels}
          onOverlay={toggleChartOverlay}
          onSubpanel={toggleIndicatorSubpanel}
        />
      </div>

      <button
        type="button"
        onClick={() => selectedSymbol && setOrderSheetOpen(true)}
        disabled={!selectedSymbol}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-maet-blue text-sm font-bold text-white disabled:opacity-40 lg:hidden"
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

function OfflineChartState({
  symbol,
  exchange,
  apiStatus,
  diagnostics,
  onRetry,
}: {
  symbol: string
  exchange: string
  apiStatus: string
  diagnostics: {
    timeframe: string
    route: string | null
    lastFetchAt: number | null
    candleCount: number
    source: string | null
    error: string | null
  }
  onRetry: () => void
}) {
  return (
    <div className="grid h-full min-h-[320px] place-items-center bg-maet-bg-deep/48 p-6 text-center" aria-label={`Price chart diagnostics for ${symbol}`}>
      <div className="reflection-card max-w-md p-5">
        <BarChart2 className="mx-auto h-8 w-8 text-maet-text-muted" />
        <h2 className="mt-4 font-heading text-lg font-bold text-maet-text-secondary">No Candle Data</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-maet-text-muted">
          Real backend candles were requested for {symbol}. Current backend status: {apiStatus.toLowerCase()}.
        </p>
        <div className="mt-4 space-y-1 rounded-md border border-maet-border bg-maet-base/70 p-3 text-left font-mono text-[11px] text-maet-text-muted">
          <DiagnosticLine label="Exchange" value={exchange} />
          <DiagnosticLine label="Timeframe" value={diagnostics.timeframe} />
          <DiagnosticLine label="Route" value={diagnostics.route ?? 'Not requested yet'} />
          <DiagnosticLine label="Last fetch" value={formatLastFetch(diagnostics.lastFetchAt)} />
          <DiagnosticLine label="Valid candles" value={String(diagnostics.candleCount)} />
          <DiagnosticLine label="Source" value={diagnostics.source ?? 'Unavailable'} />
          {diagnostics.error && <DiagnosticLine label="Result" value={diagnostics.error} />}
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="glass-button mt-4 h-10 px-4 font-mono text-xs text-maet-blue"
        >
          Retry Fetch
        </button>
      </div>
    </div>
  )
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
      <span>{label}</span>
      <span className="break-words text-maet-text-secondary">{value}</span>
    </div>
  )
}

function formatLastFetch(value: number | null): string {
  if (!value) return 'Pending'
  return new Date(value).toLocaleTimeString()
}

function IndicatorDrawer({
  open,
  overlays,
  subpanels,
  onOverlay,
  onSubpanel,
}: {
  open: boolean
  overlays: { ema: boolean; vwap: boolean; bollinger_bands: boolean }
  subpanels: { rsi: boolean; macd: boolean }
  onOverlay: (name: 'ema' | 'vwap' | 'bollinger_bands') => void
  onSubpanel: (name: 'rsi' | 'macd') => void
}) {
  return (
    <aside className={cn('reflection-card p-3 lg:block', open ? 'block' : 'hidden')}>
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-maet-violet" />
        <h2 className="font-heading text-base font-bold text-maet-text">Indicators</h2>
      </div>
      <div className="space-y-2">
        <IndicatorToggle label="EMA" checked={overlays.ema} onClick={() => onOverlay('ema')} />
        <div className="rounded-2xl border border-maet-glass-border bg-maet-bg-deep/42 px-3 py-2">
          <div className="mb-1 text-xs text-maet-text-muted">EMA period</div>
          <input type="number" defaultValue={20} min={1} className="maet-input h-9 font-mono" />
        </div>
        <IndicatorToggle label="VWAP" checked={overlays.vwap} onClick={() => onOverlay('vwap')} />
        <IndicatorToggle label="Bollinger Bands" checked={overlays.bollinger_bands} onClick={() => onOverlay('bollinger_bands')} />
        <IndicatorToggle label="RSI subpanel" checked={subpanels.rsi} onClick={() => onSubpanel('rsi')} />
        <IndicatorToggle label="MACD subpanel" checked={subpanels.macd} onClick={() => onSubpanel('macd')} />
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
        'flex h-10 w-full items-center justify-between rounded-xl border px-3 text-sm font-bold transition-colors',
        checked ? 'border-maet-violet bg-maet-violet/15 text-maet-violet' : 'border-maet-border bg-maet-base text-maet-text-secondary hover:bg-maet-elevated hover:text-maet-text'
      )}
    >
      {label}
      <span className={cn('h-4 w-7 rounded-full border p-0.5', checked ? 'border-maet-violet bg-maet-violet/20' : 'border-maet-border bg-maet-surface')}>
        <span className={cn('block h-2.5 w-2.5 rounded-full bg-current transition-transform', checked && 'translate-x-3')} />
      </span>
    </button>
  )
}
