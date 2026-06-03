'use client'

import { BarChart3 } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, fmtAge, fmtPct, fmtPrice, fmtVolume, priceDirClass } from '@/lib/utils'
import { formatIndicatorValue, latestNonNull } from '@/lib/indicator-series'
import { useNow } from '@/lib/use-now'
import { EmptyState } from './empty-state'

export function SymbolDetails() {
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const market = useTerminalStore((s) => s.marketWatch)
  const lastBySymbol = useTerminalStore((s) => s.lastTickBySymbol)
  const indicatorResults = useTerminalStore((s) => s.latestIndicatorResults)
  const now = useNow()
  const row = selected ? market[selected] : null
  const extended = row as (typeof row & { high?: number | null; low?: number | null }) | null

  if (!selected) {
    return <EmptyState title="NO SYMBOL SELECTED" hint="Select a watchlist row or use command palette search." compact />
  }

  const ltp = row?.ltp ?? null
  const change = row?.change ?? null
  const changePct = row?.change_pct ?? null
  const tickAge = lastBySymbol[selected] ? fmtAge(now - lastBySymbol[selected]) : '—'
  const indicatorAvailable = Boolean(indicatorResults?.available)

  return (
    <div className="flex h-full flex-col p-3 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold text-text tracking-wide font-mono uppercase">{selected}</span>
          <span className="px-1.5 py-0.5 rounded-sm bg-panel border border-border text-xs font-mono text-text-faint">
            {row?.exchange ?? 'NSE'}
          </span>
        </div>
        <div className="text-xs text-text-dim truncate uppercase tracking-tight">
          {row?.name ?? 'Instrument metadata'}
        </div>
      </div>

      <div className="bg-panel/40 border border-border p-3 rounded-sm space-y-1">
        <div className="text-[24px] font-bold font-mono tracking-tighter tabular-nums text-text leading-none">
          {fmtPrice(ltp)}
        </div>
        <div className="flex items-center gap-2 font-mono text-xs font-medium">
          <span className={priceDirClass(change)}>{change != null && change > 0 ? '+' : ''}{fmtPrice(change)}</span>
          <span className={cn("px-1 rounded-sm", changePct != null && changePct > 0 ? "bg-up/10 text-up" : changePct != null && changePct < 0 ? "bg-down/10 text-down" : "text-text-faint")}>
            {fmtPct(changePct)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border border border-border rounded-sm overflow-hidden">
        <Metric label="VWAP" value={fmtPrice(row?.vwap)} />
        <Metric label="Volume" value={fmtVolume(row?.volume)} />
        <Metric label="High" value={fmtPrice(extended?.high)} />
        <Metric label="Low" value={fmtPrice(extended?.low)} />
        <Metric label="Spread" value={fmtPrice(row?.spread)} />
        <Metric label="Age" value={tickAge} />
      </div>

      <div className="flex-1 min-h-0 pt-2">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-1">
          <BarChart3 className="h-3 w-3 text-info" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-dim">Analytics</span>
        </div>
        {indicatorAvailable ? (
          <div className="grid grid-cols-2 gap-2">
            <AnalyticCard label="RSI" value={formatIndicatorValue(latestNonNull(indicatorResults?.results.rsi))} />
            <AnalyticCard label="EMA 20" value={formatIndicatorValue(latestNonNull(indicatorResults?.results.ema))} />
          </div>
        ) : (
          <div className="p-4 rounded-sm border border-dashed border-border bg-panel/20 text-center">
            <div className="text-xs text-text-faint italic leading-relaxed">
              Real-time candle history is required for depth analysis.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-bg-2 p-2 min-w-0">
      <span className="text-xs uppercase tracking-wider text-text-faint font-mono">{label}</span>
      <span className="text-xs text-text font-mono truncate tabular-nums">{value}</span>
    </div>
  )
}

function AnalyticCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel/30 border border-border p-2 rounded-sm">
      <div className="text-xs uppercase tracking-widest text-text-faint font-mono">{label}</div>
      <div className="mt-1 text-[13px] font-bold text-info font-mono tabular-nums">{value}</div>
    </div>
  )
}
