import type { BacktestTrade } from '@/lib/types'
import { fmtPct, fmtPrice } from '@/lib/utils'
import { StrategyEmptyState } from './strategy-empty-state'

export function BacktestTradesTable({ trades }: { trades: BacktestTrade[] }) {
  return (
    <section className="rounded-sm border border-border bg-panel/60">
      <div className="border-b border-border bg-bg/60 px-3 py-2">
        <div className="text-xs font-semibold text-text">Trades</div>
        <div className="text-[10px] font-mono text-text-faint">Simulated long-only fills</div>
      </div>
      <TableHeader />
      {trades.length === 0 ? (
        <div className="p-3">
          <StrategyEmptyState
            title="No trades generated"
            hint="The selected rules did not produce completed simulated trades."
          />
        </div>
      ) : (
        <div className="max-h-[220px] overflow-auto">
          {trades.map((trade, index) => (
            <div key={`${trade.entry_time}-${index}`} className="grid grid-cols-9 gap-2 border-b border-border/60 px-2 py-1.5 text-[10px] font-mono text-text-2">
              <span className="truncate">{trade.entry_time}</span>
              <span className="truncate">{trade.exit_time ?? '\u2014'}</span>
              <span>{trade.side}</span>
              <span>{trade.quantity}</span>
              <span>{fmtPrice(trade.entry_price)}</span>
              <span>{fmtPrice(trade.exit_price)}</span>
              <span className={trade.net_pnl >= 0 ? 'text-up' : 'text-down'}>{fmtPrice(trade.net_pnl)}</span>
              <span>{fmtPct(trade.return_pct)}</span>
              <span className="truncate">{trade.exit_reason ?? '\u2014'}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TableHeader() {
  const columns = ['Entry', 'Exit', 'Side', 'Qty', 'Entry Px', 'Exit Px', 'Net PnL', 'Return', 'Reason']
  return (
    <div className="grid grid-cols-9 gap-2 border-b border-border bg-bg px-2 py-1.5 text-[10px] font-mono uppercase text-text-faint">
      {columns.map((column) => <span key={column}>{column}</span>)}
    </div>
  )
}

