'use client'

import {
  RefreshCw,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { indicatorKey, useTerminalStore } from '@/store/terminal-store'
import { TIMEFRAMES } from '@/lib/constants'
import { cn, fmtPrice, fmtVolume, marketSessionLabel } from '@/lib/utils'
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
import { StrategyControlPanel } from '@/components/strategy/strategy-control-panel'
import { SignalApprovalQueue } from '@/components/strategy/signal-approval-queue'
import { BrokerAccountPanel } from '@/components/portfolio/broker-account-panel'
import { MarketsWorkspace } from './markets-workspace'
import { JournalWorkspace as ObservabilityJournalWorkspace } from './journal-workspace'
import { OmsDashboard } from '@/components/oms/oms-dashboard'
import { BrokerStatusCard } from '@/components/terminal/broker-status-card'
import { AIAdvisoryCard } from '@/components/terminal/ai-advisory-card'
import { PortfolioSummaryCard } from '@/components/terminal/portfolio-summary-card'
import { OrderDryRunCard } from '@/components/terminal/order-dry-run-card'

export function WorkspaceContent() {
  const active = useTerminalStore((s) => s.activeWorkspace)

  return (
    <section className="flex-1 min-h-0 overflow-hidden">
      {active === 'trade' && <TradeWorkspace />}
      {active === 'markets' && <MarketsWorkspace />}
      {active === 'strategy' && <StrategyWorkspace />}
      {active === 'portfolio' && <PortfolioWorkspace />}
      {active === 'oms' && <OmsWorkspace />}
      {active === 'journal' && <JournalWorkspace />}
    </section>
  )
}

export function TradeWorkspace() {
  const tick = useTerminalStore((s) => s.currentTick)
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const market = useTerminalStore((s) => s.marketWatch)
  const timeframe = useTerminalStore((s) => s.chartTimeframe)
  const setTimeframe = useTerminalStore((s) => s.setChartTimeframe)

  const indicatorStatus = useTerminalStore((s) => s.indicatorStatus)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  
  const ltp = tick?.ltp ?? tick?.price
  const row = selected ? market[selected] : null
  const chg = row?.change_pct ?? null
  const candleStatus = indicatorStatus?.available ? 'READY' : 'WAITING'

  return (
    <div className="h-full flex flex-col">
      {/* Dynamic Header: Timeframe + Symbol Quick Stats */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-border bg-panel/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'h-5 px-1.5 rounded-sm text-[10px] font-mono uppercase transition-colors',
                  timeframe === tf
                    ? 'text-info bg-info/10'
                    : 'text-text-faint hover:text-text-dim'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="w-px h-3 bg-border mx-1" />
          <div className="flex items-baseline gap-2">
            <div className="text-[11px] font-mono font-bold text-text tracking-wide">
              {selected ?? tick?.symbol ?? 'SELECT SYMBOL'}
            </div>
            {ltp != null && (
              <div className={cn(
                "text-[10px] font-mono font-medium",
                chg != null && chg > 0 ? "text-up" : chg != null && chg < 0 ? "text-down" : "text-text-2"
              )}>
                {fmtPrice(ltp)}
                {chg != null && <span className="ml-1 opacity-80">({chg > 0 ? '+' : ''}{chg.toFixed(2)}%)</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <Metric label="VWAP" value={fmtPrice(tick?.vwap)} />
          <Metric label="VOL" value={fmtVolume(tick?.volume)} />
          <Metric label="CDL" value={candleStatus} />
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <PremiumChartPanel />
      </div>
    </div>
  )
}

export function PortfolioWorkspace() {
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
    <div className="h-full min-h-0 overflow-auto p-3 space-y-4">
      {/* 3D Glass Broker Terminal UI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <PortfolioSummaryCard />
        <BrokerStatusCard />
        <AIAdvisoryCard />
        <OrderDryRunCard />
      </div>

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

          <PortfolioPanel title="Holdings" subtitle="Broker holdings snapshot (Read-only reconciliation)">
            <PortfolioTable
              columns={['Symbol', 'Qty', 'Avg Price', 'LTP', 'Value', 'PnL', 'Status']}
              emptyTitle="No holdings connected"
              emptyHint="Broker holdings read-only reconciliation has not returned data."
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

        {/* Broker Account Real-Time Sync (Phase 22A) */}
        <div className="rounded-sm border border-border bg-panel/60 overflow-hidden" style={{ minHeight: '22rem' }}>
          <BrokerAccountPanel />
        </div>
      </div>
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
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Top: full strategy lab (backtest runner + templates) */}
      <div className="flex-1 min-h-0 overflow-hidden border-b border-border">
        <StrategyLab />
      </div>

      {/* Bottom split: Control Panel + Signal Queue */}
      <div className="h-80 min-h-[18rem] flex overflow-hidden shrink-0">
        <div className="w-1/2 border-r border-border min-h-0 overflow-hidden">
          <div className="h-8 px-3 flex items-center border-b border-border bg-panel/60">
            <span className="text-[10px] font-mono font-semibold text-text uppercase tracking-wider">Control Panel</span>
          </div>
          <div className="h-[calc(100%-2rem)] overflow-auto">
            <StrategyControlPanel />
          </div>
        </div>
        <div className="w-1/2 min-h-0 overflow-hidden">
          <SignalApprovalQueue />
        </div>
      </div>
    </div>
  )
}

export function JournalWorkspace() {
  return <ObservabilityJournalWorkspace />
}

export function OmsWorkspace() {
  return <OmsDashboard />
}


export function PremiumChartPanel() {
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
  const layoutMode = useTerminalStore((s) => s.chartLayoutMode)
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
    if (selected) {
      void fetchChartIndicators(selected, timeframe)
    }
  }, [fetchChartIndicators, selected, timeframe])

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-bg">
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
          isFetching={indicatorLoading}
          onFetchCandles={
            selected
              ? () => {
                  void fetchChartIndicators(selected, timeframe)
                }
              : undefined
          }
        />
        {indicatorSubpanels.rsi && <RsiPanel points={rsiPoints} />}
        {indicatorSubpanels.macd && <MacdPanel points={macdPoints} />}
      </div>
      {layoutMode === 'ANALYSIS' && (
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
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-panel/40 border border-border/40">
      <span className="text-text-dim uppercase text-[9px] tracking-tight">{label}</span>
      <span className="text-text font-medium tabular-nums">{value}</span>
    </span>
  )
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-border bg-panel/50 p-2.5 rounded-sm">
      <div className="text-[9px] font-mono uppercase tracking-widest text-text-faint">{title}</div>
      <div className="mt-1 text-sm font-mono text-text tabular-nums">{value}</div>
    </div>
  )
}
