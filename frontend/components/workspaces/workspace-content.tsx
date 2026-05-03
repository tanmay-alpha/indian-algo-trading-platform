'use client'

import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  Cpu,
  Database,
  Globe2,
  LineChart,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { TIMEFRAMES, WORKSPACES } from '@/lib/constants'
import { cn, fmtPrice, fmtVolume, fmtPct } from '@/lib/utils'
import type { Timeframe, WorkspaceId } from '@/lib/types'
import { DataQualityBadge } from '@/components/terminal/data-quality-badge'
import { EmptyState } from '@/components/terminal/empty-state'

export function WorkspaceContent() {
  const active = useTerminalStore((s) => s.activeWorkspace)

  return (
    <section className="flex-1 min-h-0 overflow-hidden">
      {active === 'trade' && <TradeWorkspace />}
      {active === 'markets' && <MarketsWorkspace />}
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

function MarketsWorkspace() {
  const indices = useTerminalStore((s) => s.indices)
  return (
    <WorkspaceFrame id="markets" icon={<Globe2 className="w-4 h-4" />}>
      <div className="p-4 grid grid-cols-3 gap-3">
        {indices.length === 0 ? (
          <div className="col-span-3">
            <EmptyState
              title="Market feed waiting"
              hint="Index values will appear when the backend feed is connected."
              icon={<Globe2 className="w-8 h-8" />}
            />
          </div>
        ) : (
          indices.map((index) => (
            <div key={index.symbol} className="border border-border bg-panel/70 rounded-sm p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-text">{index.symbol}</span>
                <DataQualityBadge quality={index.quality ?? (index.ltp == null ? 'UNAVAILABLE' : 'LIVE')} />
              </div>
              <div className="mt-3 font-mono text-xl text-text">{fmtPrice(index.ltp)}</div>
              <div className="mt-1 font-mono text-xs text-text-dim">{fmtPct(index.change_pct)}</div>
            </div>
          ))
        )}
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
  const signals = useTerminalStore((s) => s.signals)
  return (
    <WorkspaceFrame id="strategy" icon={<Cpu className="w-4 h-4" />}>
      {signals.length === 0 ? (
        <EmptyState
          title="NO STRATEGY SIGNALS"
          hint="Signals from the event stream will appear here. No synthetic signals are generated."
          icon={<Cpu className="w-8 h-8" />}
        />
      ) : (
        <div className="p-3 space-y-2">
          {signals.slice(0, 12).map((signal, index) => (
            <div key={`${signal.symbol}-${signal.ts ?? index}`} className="border border-border bg-panel/70 p-2 rounded-sm">
              <div className="flex items-center justify-between font-mono text-xs">
                <span>{signal.symbol}</span>
                <span className={signal.action === 'BUY' ? 'text-up' : signal.action === 'SELL' ? 'text-down' : 'text-text-dim'}>
                  {signal.action}
                </span>
              </div>
              <div className="mt-1 text-2xs text-text-dim">{signal.reason ?? 'No reason provided'}</div>
            </div>
          ))}
        </div>
      )}
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
      <EmptyState
        title="JOURNAL READY"
        hint="Operator notes and trade review workflows will be wired here. Nothing is persisted in this build."
        icon={<BookOpen className="w-8 h-8" />}
      />
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
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const setBottomDockTab = useTerminalStore((s) => s.setBottomDockTab)
  const tick = useTerminalStore((s) => s.currentTick)
  const indicators = ['VWAP', 'EMA', 'RSI', 'MACD', 'BB']
  const patterns = ['Doji', 'Hammer', 'Engulfing', 'Shooting Star']

  return (
    <div className="relative flex-1 overflow-hidden bg-[#070b12]">
      <div className="absolute inset-0 opacity-70 chart-grid" />
      <div className="absolute right-12 top-0 bottom-9 w-px bg-border/70" />
      <div className="absolute left-0 right-0 bottom-9 h-px bg-border/70" />
      <div className="absolute right-3 top-16 bottom-14 flex flex-col justify-between text-[9px] font-mono text-text-faint">
        <span>H</span>
        <span>MID</span>
        <span>L</span>
      </div>
      <div className="absolute left-4 right-16 top-4 h-12 rounded-md border border-border bg-bg-2/85 backdrop-blur-sm flex items-center justify-between px-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">{selected ?? tick?.symbol ?? 'Select a symbol'}</span>
            <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] font-mono text-text-dim">
              {timeframe}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-text-faint">
            Candle source waiting for backend historical data
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill icon={<Database className="w-3 h-3" />} label="Candles" value="Not loaded" />
          <StatusPill icon={<Activity className="w-3 h-3" />} label="Live ticks" value={tick ? 'Streaming' : 'Waiting'} />
        </div>
      </div>

      <div className="absolute left-4 bottom-14 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          {indicators.map((indicator) => (
            <button
              key={indicator}
              disabled
              className="h-6 px-2 rounded border border-border bg-panel/70 text-[10px] font-mono text-text-dim"
              title="Indicator placeholder"
            >
              {indicator}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {patterns.map((pattern) => (
            <button
              key={pattern}
              disabled
              className="h-6 px-2 rounded border border-border bg-panel/50 text-[10px] font-mono text-text-faint"
              title="Pattern detection placeholder"
            >
              {pattern}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="w-[420px] rounded-lg border border-border-strong bg-bg-2/92 shadow-panel pointer-events-auto">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-text">
              <LineChart className="w-4 h-4 text-info" />
              <span className="text-sm font-semibold">No candle data loaded</span>
            </div>
            <p className="mt-1 text-xs text-text-dim leading-relaxed">
              Connect historical candle source or fetch candles from the backend. No synthetic OHLCV is rendered.
            </p>
          </div>
          <div className="p-3 flex items-center gap-2">
            <button
              disabled
              className="h-8 px-3 rounded border border-border bg-panel text-xs font-medium text-text-dim"
            >
              <RefreshCw className="inline w-3.5 h-3.5 mr-1.5" />
              Retry candles
            </button>
            <button
              onClick={() => setWorkspace('risk')}
              className="h-8 px-3 rounded border border-border bg-panel hover:border-info/40 text-xs text-text-2"
            >
              View backend status
            </button>
            <button
              onClick={() => setBottomDockTab('system-health')}
              className="h-8 px-3 rounded border border-info/30 bg-info-dim text-xs text-info"
            >
              Open System Health
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-4 right-16 bottom-0 h-9 flex items-center justify-between border-t border-border bg-bg-2/85 px-3 text-[10px] font-mono text-text-faint">
        <span>Event timeline</span>
        <span>Signals, candle loads, and feed changes will appear here</span>
      </div>
    </div>
  )
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-border bg-panel px-2 h-6 text-[10px] font-mono">
      <span className="text-info">{icon}</span>
      <span className="text-text-faint">{label}</span>
      <span className="text-text-2">{value}</span>
    </span>
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
