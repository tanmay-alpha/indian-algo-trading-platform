'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'

interface WatchlistPanelProps {
  className?: string
}

export function WatchlistPanel({ className }: WatchlistPanelProps) {
  const [query, setQuery] = useState('')
  const activeSym = useTerminalStore((state) => state.activeSym)
  const setActiveSym = useTerminalStore((state) => state.setActiveSym)

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return DEMO_SYMBOLS

    return DEMO_SYMBOLS.filter((item) => {
      return item.sym.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized)
    })
  }, [query])

  return (
    <aside className={cn('flex min-h-0 w-[240px] shrink-0 flex-col overflow-hidden border-r border-border bg-panel', className)}>
      <div className="border-b border-border p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search NSE / BSE..."
            className="h-8 w-full rounded border border-border bg-surface pl-7 pr-2 font-mono text-[10px] text-text-primary outline-none placeholder:text-text-hint focus:border-accent"
          />
        </label>
      </div>

      <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        Watchlist
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((item) => {
          const active = activeSym === item.sym
          const positive = item.chg >= 0

          return (
            <button
              key={item.sym}
              type="button"
              onClick={() => setActiveSym(item.sym)}
              className="w-full border-b border-border px-3 py-2 text-left transition-colors hover:bg-hover data-[active=true]:border-l-2 data-[active=true]:border-l-accent data-[active=true]:bg-surface data-[active=true]:pl-[10px]"
              data-active={active}
            >
              <span className="grid grid-cols-[minmax(0,1fr)_60px_74px] items-center gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-text-primary">{item.sym}</span>
                  <span className="block truncate text-[10px] text-text-muted">{item.name}</span>
                </span>
                <MiniSparkline symbol={item.sym} positive={positive} />
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-xs text-text-primary">{formatINR(item.price)}</span>
                  <span className={`block font-mono text-[10px] ${positive ? 'text-up' : 'text-dn'}`}>
                    {positive ? '+' : ''}{item.chg.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function MiniSparkline({ symbol, positive }: { symbol: string; positive: boolean }) {
  const values = useMemo(() => {
    const seed = Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return Array.from({ length: 8 }, (_, index) => {
      const drift = Math.sin((seed + index * 17) / 11) * 7
      const trend = positive ? index * 1.4 : (7 - index) * 1.4
      return 16 - trend + drift
    })
  }, [positive, symbol])

  const points = values
    .map((value, index) => {
      const x = 4 + index * 7
      const y = Math.round(Math.min(18, Math.max(3, value)) * 1000) / 1000
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="60" height="20" viewBox="0 0 60 20" className="shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? 'var(--color-up)' : 'var(--color-dn)'}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
}
