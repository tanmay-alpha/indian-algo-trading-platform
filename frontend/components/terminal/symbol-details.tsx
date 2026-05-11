'use client'

import { BarChart3 } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtAge, fmtPct, fmtPrice, fmtVolume, priceDirClass } from '@/lib/utils'
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
    <div className="space-y-3 p-3">
      <div className="border-b border-border pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[13px] font-semibold text-text">{selected}</div>
            <div className="mt-0.5 truncate text-[10px] text-text-faint">
              {row?.name ?? 'Instrument metadata unavailable'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[20px] font-semibold tabular-nums text-text">
              {fmtPrice(ltp)}
            </div>
            <div className="flex items-center justify-end gap-2 font-mono text-[10px]">
              <span className={priceDirClass(change)}>{fmtPrice(change)}</span>
              <span className={priceDirClass(changePct)}>{fmtPct(changePct)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border border-border">
        <Metric label="VWAP" value={fmtPrice(row?.vwap)} />
        <Metric label="Volume" value={fmtVolume(row?.volume)} />
        <Metric label="High" value={fmtPrice(extended?.high)} />
        <Metric label="Low" value={fmtPrice(extended?.low)} />
        <Metric label="Spread" value={fmtPrice(row?.spread)} />
        <Metric label="Tick Age" value={tickAge} />
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2 text-info">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px] uppercase tracking-wider">Indicator Snapshot</span>
        </div>
        {indicatorAvailable ? (
          <div className="grid grid-cols-2 border border-border">
            <Metric label="RSI" value={formatIndicatorValue(latestNonNull(indicatorResults?.results.rsi))} />
            <Metric label="EMA" value={formatIndicatorValue(latestNonNull(indicatorResults?.results.ema))} />
          </div>
        ) : (
          <div className="border border-border bg-panel/40 px-2 py-2 text-[10px] text-text-faint">
            Candle history is required for symbol analytics. No synthetic chart data is shown.
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-8 items-center justify-between border-b border-r border-border bg-panel/40 px-2 font-mono text-[10px]">
      <span className="text-text-faint">{label}</span>
      <span className="text-text-2">{value}</span>
    </div>
  )
}
