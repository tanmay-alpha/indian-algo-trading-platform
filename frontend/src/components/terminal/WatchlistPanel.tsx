'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import { useTerminalStore } from '@/store/terminal-store'

export function WatchlistPanel() {
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
    <aside className="flex min-h-0 w-[240px] shrink-0 flex-col overflow-hidden border-r border-border bg-panel">
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

      <div className="border-b border-border px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-widest text-text-muted">
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
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs font-medium text-text-primary">{item.sym}</span>
                  <span className="block truncate text-[10px] text-text-muted">{item.name}</span>
                </span>
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
