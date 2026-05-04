'use client'

import {
  BarChart3,
  BookOpen,
  Briefcase,
  Cpu,
  Globe2,
  LineChart,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { indicatorKey, useTerminalStore } from '@/store/terminal-store'
import { TIMEFRAMES, WORKSPACES } from '@/lib/constants'
import { cn, fmtPrice, fmtVolume, fmtPct, marketSessionLabel } from '@/lib/utils'
import {
  formatIndicatorValue,
  latestNonNull,
  mapLineSeries,
  mapMacdSeries,
} from '@/lib/indicator-series'
import type { IndicatorResultsResponse, Timeframe, WorkspaceId } from '@/lib/types'
import { DataQualityBadge } from '@/components/terminal/data-quality-badge'
import { EmptyState } from '@/components/terminal/empty-state'
import { IndicatorChartShell } from '@/components/chart/indicator-chart-shell'
import { IndicatorOverlayControls } from '@/components/chart/indicator-overlay-controls'
import { RsiPanel } from '@/components/chart/rsi-panel'
import { MacdPanel } from '@/components/chart/macd-panel'
import { StrategyLab } from '@/components/strategy/strategy-lab'
import { MarketsWorkspace } from './markets-workspace'
import { JournalWorkspace as ObservabilityJournalWorkspace } from './journal-workspace'

export function WorkspaceContent() {
  const active = useTerminalStore((s) => s.activeWorkspace)

  return (
    <section className="flex-1 min-h-0 overflow-hidden">
      {active === 'trade' && <TradeWorkspace />}
      {active === 'markets' && (
        <WorkspaceFrame id="markets" icon={<Globe2 className="w-4 h-4" />}>
          <MarketsWorkspace />
        </WorkspaceFrame>
      )}
      {active === 'charts' && <ChartsWorkspace />}
      {active === 'portfolio' && <PortfolioWorkspace />}
      {active === 'strategy' && <StrategyWorkspace />}
      {active === 'risk' && <RiskWorkspace />}
      {active === 'journal' && <JournalWorkspace />}
    </section>
  )
}

function TradeWorkspace() {
  const tick = useTerminalStore((s) => s.currentTick)
  const selected = useTerminalStore((s) => s.selectedSymbol)
  return (
    <WorkspaceFrame id="trade" icon={<BarChart3 className="w-4 h-4" />}>
      <div className="h-full grid grid-rows-[auto_1fr]">
        <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-panel/60">
          <div className="font-mono">
            <span className="text-text-dim text-2xs uppercase tracking-wider">Selected</span>
            <div className="text-sm text-text">{selected ?? tick?.symbol ?? 'No symbol selected'}</div>
          </div>
          <div className="flex items-center gap-5 font-mono text-xs">
            <Metric label="LTP" value={fmtPrice(tick?.ltp ?? tick?.price)} />
            <Metric label="VWAP" value={fmtPrice(tick?.vwap)} />
            <Metric label="VOL" value={fmtVolume(tick?.volume)} />
          </div>
        </div>
        <PremiumChartPanel />
      </div>
    </WorkspaceFrame>
  )
}

function ChartsWorkspace() {
  const timeframe = useTerminalStore((s) => s.chartTimeframe)
  const setTimeframe = useTerminalStore((s) => s.setChartTimeframe)
  return (
    <WorkspaceFrame id="charts" icon={<LineChart className="w-4 h-4" />}>
      <div className="h-full flex flex-col">
        <div className="h-10 px-4 flex items-center gap-1.5 border-b border-border bg-panel/60">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'h-6 px-2 rounded-sm border text-2xs font-mono uppercase',
                timeframe === tf
                  ? 'text-info bg-info-dim border-info/30'
                  : 'text-text-dim bg-panel border-border hover:text-text'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <PremiumChartPanel />
      </div>
    </WorkspaceFrame>
  )
}

function PortfolioWorkspace() {
  const summary = useTerminalStore((s) => s.portfolioSummary)
  const positions = useTerminalStore((s) => s.positions)
  const holdings = useTerminalStore((s) => s.holdings)
  const equityCurve = useTerminalStore((s) => s.equityCurve)
  const reconciliation = useTerminalStore((s) => s.reconciliationStatus)
  const loading = useTerminalStore((s) => s.portfolioLoading)
  const error = useTerminalStore((s) => s.portfolioError)
  const refreshPortfolio = useTerminalStore((s) => s.refreshPortfolio)
  const quality = summary?.data_status === 'AVAILABLE' ? 'LIVE' : error ? 'BACKEND OFFLINE' : 'UNAVAILABLE'
  const source = summary?.source_of_truth || (summary?.trading_mode === 'LIVE' ? 'BROKER' : 'INTERNAL')
  return (
    <WorkspaceFrame id="portfolio" icon={<Briefcase className="w-4 h-4" />}>
      <div className="h-full min-h-0 overflow-auto p-3 space-y-3">
        <div className="flex items-center justify-between rounded-sm border border-border bg-panel/60 px-3 py-2">
          <div>
            <div className="text-xs font-semibold text-text">Portfolio Control</div>
            <div className="mt-0.5 text-[10px] font-mono text-text-faint">
              Source of truth: {summary?.trading_mode === 'LIVE' ? 'LIVE broker' : 'PAPER internal'} / {source}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DataQualityBadge quality={quality} />
            <button
              onClick={() => refreshPortfolio()}
              disabled={loading}
              className="h-7 px-2 rounded-sm border border-border bg-bg text-[10px] font-mono text-text-dim hover:text-text disabled:opacity-50"
            >
              <RefreshCw className="inline w-3 h-3 mr-1" />
              {loading ? 'Loading' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat title="Realized PnL" value={fmtPrice(summary?.realized_pnl)} />
          <Stat title="Unrealized PnL" value={fmtPrice(summary?.unrealized_pnl)} />
          <Stat title="Net PnL" value={fmtPrice(summary?.net_pnl)} />
          <Stat title="Total Fees" value={fmtPrice(summary?.total_fees)} />
          <Stat title="Open Positions" value={String(summary?.open_positions_count ?? 0)} />
          <Stat title="Open Notional" value={fmtPrice(summary?.total_open_notional)} />
          <Stat title="Equity" value={fmtPrice(summary?.equity)} />
          <Stat title="Max Drawdown" value={fmtPrice(summary?.max_drawdown)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <PortfolioPanel title="Positions" subtitle="Internal paper fills / broker-reconciled later">
            <PortfolioTable
              columns={['Symbol', 'Qty', 'Avg Price', 'LTP', 'Unreal PnL', 'Real PnL', 'Fees', 'Net PnL', 'Quality']}
              emptyTitle="No open positions"
              emptyHint="Filled paper orders will create internal positions."
              rows={positions.map((position) => [
                position.symbol,
                String(position.quantity),
                fmtPrice(position.avg_price),
                fmtPrice(position.ltp),
                fmtPrice(position.unrealized_pnl),
                fmtPrice(position.realized_pnl),
                fmtPrice(position.fees),
                fmtPrice(position.net_pnl),
                position.quality,
              ])}
            />
          </PortfolioPanel>

          <PortfolioPanel title="Holdings" subtitle="Broker holdings snapshot when available">
            <PortfolioTable
              columns={['Symbol', 'Qty', 'Avg Price', 'LTP', 'Value', 'PnL', 'Status']}
              emptyTitle="No holdings connected"
              emptyHint="Broker holdings sync has not returned data."
              rows={holdings.map((holding) => [
                holding.symbol,
                String(holding.quantity),
                fmtPrice(holding.average_price),
                fmtPrice(holding.ltp),
                fmtPrice(holding.value),
                fmtPrice(holding.pnl),
                holding.data_status,
              ])}
            />
          </PortfolioPanel>

          <PortfolioPanel title="Equity Curve" subtitle="Created from portfolio events">
            {equityCurve.length === 0 ? (
              <EmptyState
                title="No equity curve data yet"
                hint="Equity points are created after portfolio events."
                compact
              />
            ) : (
              <div className="p-2 space-y-1">
                {equityCurve.slice(-8).map((point) => (
                  <div key={`${point.timestamp}-${point.equity}`} className="grid grid-cols-3 gap-2 border border-border bg-bg/70 px-2 py-1 text-[10px] font-mono">
                    <span className="truncate text-text-faint">{new Date(point.timestamp).toLocaleTimeString()}</span>
                    <span className="text-text">{fmtPrice(point.equity)}</span>
                    <span className="text-warn">{fmtPrice(point.drawdown)}</span>
                  </div>
                ))}
              </div>
            )}
          </PortfolioPanel>

          <PortfolioPanel title="Reconciliation" subtitle="Internal vs broker state">
            <div className="p-2 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat title="Mismatch Count" value={String(reconciliation?.summary.mismatch_count ?? 0)} />
                <Stat title="Critical" value={String(reconciliation?.summary.by_severity.CRITICAL ?? 0)} />
                <Stat title="Status" value={reconciliation?.summary.ok ? 'OK' : 'MISMATCH'} />
              </div>
              <PortfolioTable
                columns={['Symbol', 'Field', 'Severity', 'Message']}
                emptyTitle="No reconciliation mismatches"
                emptyHint="Broker and internal state differences will appear here."
                rows={[...(reconciliation?.positions || []), ...(reconciliation?.holdings || [])].map((mismatch) => [
                  mismatch.symbol,
                  mismatch.field,
                  mismatch.severity,
                  mismatch.message,
                ])}
              />
            </div>
          </PortfolioPanel>
        </div>
      </div>
    </WorkspaceFrame>
  )
}

function PortfolioPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="min-h-[210px] rounded-sm border border-border bg-panel/60 overflow-hidden">
      <div className="h-9 px-3 flex items-center justify-between border-b border-border bg-bg/60">
        <div>
          <div className="text-xs font-semibold text-text">{title}</div>
          <div className="text-[9px] font-mono text-text-faint">{subtitle}</div>
        </div>
      </div>
      {children}
    </section>
  )
}

function PortfolioTable({
  columns,
  rows,
  emptyTitle,
  emptyHint,
}: {
  columns: string[]
  rows: string[][]
  emptyTitle: string
  emptyHint: string
}) {
  return (
    <div className="h-full min-h-[160px] flex flex-col">
      <div
        className="grid gap-2 px-2 py-1.5 border-b border-border bg-bg text-[9px] font-mono uppercase tracking-wider text-text-faint"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <span key={column} className="truncate">{column}</span>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="flex-1 grid place-items-center">
          <EmptyState title={emptyTitle} hint={emptyHint} compact />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {rows.map((row, index) => (
            <div
              key={`${row[0]}-${index}`}
              className="grid gap-2 px-2 py-1.5 border-b border-border/60 text-[10px] font-mono text-text-2"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {row.map((cell, cellIndex) => (
                <span key={`${cell}-${cellIndex}`} className="truncate">{cell}</span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StrategyWorkspace() {
  return (
    <WorkspaceFrame id="strategy" icon={<Cpu className="w-4 h-4" />}>
      <StrategyLab />
    </WorkspaceFrame>
  )
}

function RiskWorkspace() {
  const status = useTerminalStore((s) => s.terminalStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const portfolioSummary = useTerminalStore((s) => s.portfolioSummary)
  return (
    <WorkspaceFrame id="risk" icon={<ShieldCheck className="w-4 h-4" />}>
      <div className="p-4 grid grid-cols-2 gap-3">
        <Stat title="Broker" value={broker?.logged_in ? 'ONLINE' : broker ? 'OFFLINE' : '\u2014'} />
        <Stat title="Feed Token" value={broker?.feed_token_available ? 'AVAILABLE' : broker ? 'WAITING' : '\u2014'} />
        <Stat title="EventBus Total" value={String(status?.event_bus?.total ?? '\u2014')} />
        <Stat title="Tick Drop" value={status?.tick_bus?.drop_rate_pct == null ? '\u2014' : `${status.tick_bus.drop_rate_pct.toFixed(2)}%`} />
        <Stat title="Portfolio Net PnL" value={fmtPrice(portfolioSummary?.net_pnl ?? status?.portfolio?.net_pnl)} />
        <Stat title="Portfolio Drawdown" value={fmtPrice(portfolioSummary?.current_drawdown ?? status?.portfolio?.current_drawdown)} />
      </div>
    </WorkspaceFrame>
  )
}

function JournalWorkspace() {
  return (
    <WorkspaceFrame id="journal" icon={<BookOpen className="w-4 h-4" />}>
      <ObservabilityJournalWorkspace />
    </WorkspaceFrame>
  )
}

function WorkspaceFrame({
  id,
  icon,
  children,
}: {
  id: WorkspaceId
  icon: ReactNode
  children: ReactNode
}) {
  const def = WORKSPACES.find((w) => w.id === id)
  return (
    <div className="h-full flex flex-col">
      <div className="h-9 px-4 flex items-center gap-2 border-b border-border bg-bg-2">
        <span className="text-info">{icon}</span>
        <span className="font-mono text-xs uppercase tracking-wider text-text">{def?.label}</span>
        <span className="text-2xs font-mono text-text-faint">WORKSPACE</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  )
}

function PremiumChartPanel() {
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const timeframe = useTerminalStore((s) => s.chartTimeframe)
  const tick = useTerminalStore((s) => s.currentTick)
  const indicatorStatus = useTerminalStore((s) => s.indicatorStatus)
  const indicatorLoading = useTerminalStore((s) => s.indicatorChartLoading)
  const indicatorError = useTerminalStore((s) => s.indicatorChartError)
  const chartOverlays = useTerminalStore((s) => s.chartOverlays)
  const indicatorSubpanels = useTerminalStore((s) => s.indicatorSubpanels)
  const activeIndicatorNames = useTerminalStore((s) => s.activeIndicatorNames)
  const indicatorResultsByKey = useTerminalStore((s) => s.indicatorResultsBySymbolTimeframe)
  const chartCandlesByKey = useTerminalStore((s) => s.chartCandlesBySymbolTimeframe)
  const chartSignalMarkers = useTerminalStore((s) => s.chartSignalMarkers)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const fetchIndicatorStatus = useTerminalStore((s) => s.fetchIndicatorStatus)
  const fetchChartIndicators = useTerminalStore((s) => s.fetchChartIndicators)
  const toggleChartOverlay = useTerminalStore((s) => s.toggleChartOverlay)
  const toggleIndicatorSubpanel = useTerminalStore((s) => s.toggleIndicatorSubpanel)
  const chartKey = selected ? indicatorKey(selected, timeframe) : null
  const indicatorResults = chartKey ? indicatorResultsByKey[chartKey] : undefined
  const candles = chartKey ? chartCandlesByKey[chartKey] || [] : []
  const noCandles = indicatorResults?.available === false && indicatorResults.reason === 'NO_CANDLES'
  const rsiPoints = mapLineSeries(candles, indicatorResults?.results.rsi)
  const macdPoints = mapMacdSeries(candles, indicatorResults?.results.macd)

  useEffect(() => {
    void fetchIndicatorStatus()
  }, [fetchIndicatorStatus])

  useEffect(() => {
    if (selected && activeIndicatorNames.length > 0) {
      void fetchChartIndicators(selected, timeframe)
    }
  }, [activeIndicatorNames, fetchChartIndicators, selected, timeframe])

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#070b12]">
      <div className="h-full min-h-0 flex flex-col">
        <IndicatorChartShell
          symbol={selected ?? tick?.symbol ?? null}
          timeframe={timeframe}
          candles={candles}
          result={indicatorResults}
          overlays={chartOverlays}
          signalMarkers={chartSignalMarkers}
          apiStatus={apiStatus}
          backendWakeState={backendWakeState}
        />
        {indicatorSubpanels.rsi && <RsiPanel points={rsiPoints} />}
        {indicatorSubpanels.macd && <MacdPanel points={macdPoints} />}
      </div>
      <IndicatorOverlayControls
        overlays={chartOverlays}
        subpanels={indicatorSubpanels}
        status={indicatorStatus}
        loading={indicatorLoading}
        noCandles={Boolean(noCandles)}
        error={indicatorError}
        onToggleOverlay={toggleChartOverlay}
        onToggleSubpanel={toggleIndicatorSubpanel}
      />
      <IndicatorSummaryPanel
        result={indicatorResults}
        status={indicatorStatus?.selected_engine ?? null}
        marketState={marketSessionLabel()}
        selected={selected ?? tick?.symbol ?? null}
        timeframe={timeframe}
      />
      <div className="absolute left-4 right-16 bottom-0 h-9 flex items-center justify-between border-t border-border bg-bg-2/85 px-3 text-[10px] font-mono text-text-faint">
        <span>Event timeline</span>
        <span>Signals, candle loads, and feed changes will appear here</span>
      </div>
    </div>
  )
}

function IndicatorSummaryPanel({
  result,
  status,
  marketState,
  selected,
  timeframe,
}: {
  result?: IndicatorResultsResponse
  status: string | null
  marketState: string
  selected: string | null
  timeframe: Timeframe
}) {
  const bb = result?.results.bollinger_bands
  return (
    <div className="absolute right-16 top-20 z-20 w-[280px] rounded-md border border-border bg-bg-2/90 backdrop-blur-sm shadow-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-text">Indicator Summary</div>
          <div className="text-[9px] font-mono text-text-faint">
            {selected ?? 'No symbol'} / {timeframe}
          </div>
        </div>
        <span className="rounded border border-info/30 bg-info-dim px-2 py-0.5 text-[10px] font-mono uppercase text-info">
          {result?.engine ?? status ?? 'python'}
        </span>
      </div>
      <div className="space-y-2 p-3 text-[10px] font-mono">
        {result?.available ? (
          <>
            <IndicatorRow label="EMA latest" value={formatIndicatorValue(latestNonNull(result.results.ema))} />
            <IndicatorRow label="RSI latest" value={formatIndicatorValue(latestNonNull(result.results.rsi))} />
            <IndicatorRow label="MACD hist" value={formatIndicatorValue(latestNonNull(result.results.macd?.histogram))} />
            <IndicatorRow label="VWAP latest" value={formatIndicatorValue(latestNonNull(result.results.vwap))} />
            <IndicatorRow label="BB upper" value={formatIndicatorValue(latestNonNull(bb?.upper))} />
            <IndicatorRow label="BB lower" value={formatIndicatorValue(latestNonNull(bb?.lower))} />
            <IndicatorRow label="Market" value={marketState} />
          </>
        ) : (
          <div className="rounded-sm border border-border bg-panel/60 px-2 py-1.5 text-text-faint">
            Indicator engine ready - candle data required.
          </div>
        )}
      </div>
    </div>
  )
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border/60 bg-panel/50 px-2 py-1">
      <span className="text-text-faint">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-text-faint">{label}</span>
      <span className="text-text">{value}</span>
    </span>
  )
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-border bg-panel/70 p-3 rounded-sm">
      <div className="text-2xs font-mono uppercase tracking-wider text-text-faint">{title}</div>
      <div className="mt-2 text-sm font-mono text-text">{value}</div>
    </div>
  )
}
