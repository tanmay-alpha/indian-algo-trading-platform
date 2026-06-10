'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Play } from 'lucide-react'
import { ErrorBoundary } from '@/components/effects/error-boundary'
import { StatusBar } from '@/components/terminal/StatusBar'
import { TopBar } from '@/components/terminal/TopBar'
import { Badge } from '@/components/ui/Badge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { DEMO_STRATEGY_TEMPLATES, defaultStrategyConfig, generateDemoBacktestResult } from '@/lib/demoStrategy'
import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import type { BacktestEquityPoint, BacktestResult, StrategyConfig } from '@/lib/types'
import { useTerminalStore } from '@/store/terminal-store'

export function StrategyLab() {
  useWebSocket()

  const activeSym = useTerminalStore((state) => state.activeSym)
  const [strategyName, setStrategyName] = useState(DEMO_STRATEGY_TEMPLATES[0].strategyName)
  const [symbol, setSymbol] = useState(activeSym || 'RELIANCE')
  const [timeframe, setTimeframe] = useState('5m')
  const [startDate, setStartDate] = useState('2026-06-03')
  const [endDate, setEndDate] = useState('2026-06-09')
  const [result, setResult] = useState<BacktestResult>(() => generateDemoBacktestResult(defaultStrategyConfig(symbol, strategyName)))
  const [loading, setLoading] = useState(false)
  const [demo, setDemo] = useState(true)

  const template = useMemo(
    () => DEMO_STRATEGY_TEMPLATES.find((item) => item.strategyName === strategyName) ?? DEMO_STRATEGY_TEMPLATES[0],
    [strategyName]
  )

  async function runBacktest() {
    const payload: StrategyConfig & { start_date: string; end_date: string } = {
      ...defaultStrategyConfig(symbol, strategyName),
      timeframe,
      start_date: startDate,
      end_date: endDate,
      params: template.params,
    }

    setLoading(true)
    try {
      const response = await fetch('/api/backend/strategies/backtest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Backtest API unavailable')
      const nextResult = (await response.json()) as BacktestResult & { demo?: boolean }
      setResult(hasEquity(nextResult) ? nextResult : generateDemoBacktestResult(payload))
      setDemo(Boolean(nextResult.demo) || !hasEquity(nextResult))
    } catch {
      setResult(generateDemoBacktestResult(payload))
      setDemo(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-base text-text-primary">
      <TopBar />
      <ErrorBoundary boundaryName="Strategy Lab">
        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[340px_1fr]">
            <aside className="border border-border bg-panel p-4">
              <Link href="/terminal" className="inline-flex items-center gap-2 font-mono text-[10px] text-text-muted hover:text-accent">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Terminal
              </Link>

              <div className="mt-5 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-text-primary">Strategy Lab</h1>
                  <p className="mt-2 text-sm leading-6 text-text-muted">Offline backtests for template-based research on NSE symbols.</p>
                </div>
                <Badge variant={demo ? 'warn' : 'paper'}>{demo ? 'Demo mode' : 'Backend'}</Badge>
              </div>

              <div className="mt-6 space-y-4">
                <Field label="Template">
                  <select value={strategyName} onChange={(event) => setStrategyName(event.target.value as typeof strategyName)} className={fieldClass}>
                    {DEMO_STRATEGY_TEMPLATES.map((item) => (
                      <option key={item.strategyName} value={item.strategyName}>{item.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Symbol">
                  <select value={symbol} onChange={(event) => setSymbol(event.target.value)} className={fieldClass}>
                    {DEMO_SYMBOLS.filter((item) => item.sym !== 'NIFTY50').map((item) => (
                      <option key={item.sym} value={item.sym}>{item.sym}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Timeframe">
                  <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)} className={fieldClass}>
                    {['1m', '5m', '15m', '1h', '1d'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start">
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} />
                  </Field>
                  <Field label="End">
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={runBacktest}
                  disabled={loading}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded border border-accent/40 bg-accent-dim font-mono text-[11px] font-medium text-accent transition-colors hover:bg-accent hover:text-[#1A1600] disabled:cursor-wait disabled:opacity-70"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {loading ? 'Running...' : 'Run backtest'}
                </button>
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
              <section className="border border-border bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Equity curve</div>
                    <div className="mt-1 font-mono text-sm text-text-primary">{result.strategy_name} | {result.symbol} | {result.timeframe}</div>
                  </div>
                  <Badge variant={result.metrics.net_pnl >= 0 ? 'up' : 'dn'}>
                    {result.metrics.net_pnl >= 0 ? '+' : ''}{formatINR(result.metrics.net_pnl)}
                  </Badge>
                </div>
                <EquityMiniChart points={result.equity_curve} />
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total return" value={`${formatPercent(result.metrics.total_return_pct)}`} tone={result.metrics.total_return_pct >= 0 ? 'up' : 'dn'} />
                <MetricCard label="Max drawdown" value={formatPercent(result.metrics.max_drawdown)} tone="warn" />
                <MetricCard label="Win rate" value={formatPercent(result.metrics.win_rate)} tone="neutral" />
                <MetricCard label="Sharpe proxy" value={(result.metrics.profit_factor ?? 1.42).toFixed(2)} tone="neutral" />
              </section>

              <section className="border border-border bg-panel">
                <div className="border-b border-border px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Trades</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left font-mono text-[11px]">
                    <thead className="text-text-muted">
                      <tr>
                        <th className="px-4 py-2 font-medium">Side</th>
                        <th className="px-4 py-2 font-medium">Entry</th>
                        <th className="px-4 py-2 font-medium">Exit</th>
                        <th className="px-4 py-2 text-right font-medium">Net P&L</th>
                        <th className="px-4 py-2 text-right font-medium">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((trade, index) => (
                        <tr key={`${trade.entry_time}-${index}`} className="border-t border-border text-text-primary">
                          <td className="px-4 py-3">{trade.side}</td>
                          <td className="px-4 py-3">{formatINR(trade.entry_price)}</td>
                          <td className="px-4 py-3">{trade.exit_price == null ? 'Open' : formatINR(trade.exit_price)}</td>
                          <td className={trade.net_pnl >= 0 ? 'px-4 py-3 text-right text-up' : 'px-4 py-3 text-right text-dn'}>{formatINR(trade.net_pnl)}</td>
                          <td className="px-4 py-3 text-right">{formatPercent(trade.return_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </section>
      </ErrorBoundary>
      <StatusBar />
    </main>
  )
}

const fieldClass = 'h-9 w-full rounded border border-border bg-surface px-2 font-mono text-[11px] text-text-primary outline-none focus:border-accent'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</span>
      {children}
    </label>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'up' | 'dn' | 'warn' | 'neutral' }) {
  const valueClass = tone === 'up' ? 'text-up' : tone === 'dn' ? 'text-dn' : tone === 'warn' ? 'text-warn' : 'text-text-primary'

  return (
    <div className="border border-border bg-panel p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</div>
      <div className={`mt-2 font-mono text-2xl tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function EquityMiniChart({ points }: { points: BacktestEquityPoint[] }) {
  const path = useMemo(() => {
    if (points.length === 0) return ''
    const values = points.map((point) => point.equity)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const spread = Math.max(1, max - min)
    return values
      .map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * 100
        const y = 86 - ((value - min) / spread) * 72
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  }, [points])

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-64 w-full border border-border bg-base">
      {[20, 40, 60, 80].map((line) => (
        <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="rgba(255,255,255,0.06)" strokeWidth="0.35" />
      ))}
      <polyline points={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function hasEquity(result: BacktestResult) {
  return Array.isArray(result.equity_curve) && result.equity_curve.length > 0
}

function formatPercent(value: number) {
  return `${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}
