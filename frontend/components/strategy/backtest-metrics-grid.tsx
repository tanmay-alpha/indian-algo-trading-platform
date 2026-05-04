import type { BacktestResult } from '@/lib/types'
import { fmtPct, fmtPrice } from '@/lib/utils'
import { StrategyEmptyState } from './strategy-empty-state'

export function BacktestMetricsGrid({ result }: { result: BacktestResult | null }) {
  if (!result) {
    return (
      <StrategyEmptyState
        title="No backtest run yet"
        hint="Select a template and run a backtest against backend CandleStore data."
      />
    )
  }

  if (result.status === 'NO_CANDLES') {
    return (
      <StrategyEmptyState
        title="No candle data available for backtest"
        hint="Load candles for the selected symbol/timeframe before running strategy research."
      />
    )
  }

  const metrics = result.metrics
  const items = [
    ['Trades', String(metrics.total_trades)],
    ['Win Rate', fmtPct(metrics.win_rate)],
    ['Net PnL', fmtPrice(metrics.net_pnl)],
    ['Gross PnL', fmtPrice(metrics.gross_pnl)],
    ['Fees', fmtPrice(metrics.total_fees)],
    ['Slippage', fmtPrice(metrics.total_slippage)],
    ['Max DD', fmtPct(metrics.max_drawdown)],
    ['Return', fmtPct(metrics.total_return_pct)],
    ['Profit Factor', metrics.profit_factor == null ? '\u2014' : metrics.profit_factor.toFixed(2)],
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-sm border border-border bg-panel/60 p-3">
          <div className="text-[10px] font-mono uppercase text-text-faint">{label}</div>
          <div className="mt-2 font-mono text-sm text-text">{value}</div>
        </div>
      ))}
    </div>
  )
}

