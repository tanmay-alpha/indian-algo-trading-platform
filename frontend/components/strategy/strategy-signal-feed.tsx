import type { StrategySignal } from '@/lib/types'
import { fmtPrice } from '@/lib/utils'
import { StrategyEmptyState } from './strategy-empty-state'

export function StrategySignalFeed({ signals }: { signals: StrategySignal[] }) {
  return (
    <section className="rounded-sm border border-border bg-panel/60">
      <div className="border-b border-border bg-bg/60 px-3 py-2">
        <div className="text-xs font-semibold text-text">Signal Preview</div>
        <div className="text-[9px] font-mono text-text-faint">Research signals only, not routed to execution</div>
      </div>
      {signals.length === 0 ? (
        <div className="p-3">
          <StrategyEmptyState
            title="No signals"
            hint="Run a preview or backtest to see BUY/EXIT research signals."
          />
        </div>
      ) : (
        <div className="max-h-[220px] overflow-auto p-2 space-y-1">
          {signals.slice(-40).map((signal, index) => (
            <div key={`${signal.timestamp}-${index}`} className="grid grid-cols-[80px_54px_80px_1fr] gap-2 rounded-sm border border-border/70 bg-bg/70 px-2 py-1.5 text-[10px] font-mono">
              <span className="truncate text-text-faint">{signal.timestamp}</span>
              <span className={signal.action === 'BUY' ? 'text-up' : signal.action === 'EXIT' ? 'text-warn' : 'text-text-dim'}>
                {signal.action}
              </span>
              <span className="text-text">{fmtPrice(signal.price)}</span>
              <span className="truncate text-text-dim">
                {(signal.strength * 100).toFixed(0)}% - {signal.reason}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

