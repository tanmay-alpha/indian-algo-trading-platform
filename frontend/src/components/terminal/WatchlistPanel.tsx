'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEMO_SYMBOLS, type DemoSymbol } from '@/lib/demoSymbols'

interface WatchlistPanelProps {
  activeSymbol: string
  onSelect: (symbol: DemoSymbol) => void
}

function formatPrice(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export function WatchlistPanel({ activeSymbol, onSelect }: WatchlistPanelProps) {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return DEMO_SYMBOLS

    return DEMO_SYMBOLS.filter((item) => {
      return item.sym.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized)
    })
  }, [query])

  return (
    <aside className="flex min-h-0 w-[220px] shrink-0 flex-col border-r border-border bg-panel">
      <div className="border-b border-border p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-8 w-full rounded-sm border border-border bg-base pl-7 pr-2 font-mono text-[11px] text-primary outline-none placeholder:text-hint focus:border-strong"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((item) => {
          const active = activeSymbol === item.sym
          const positive = item.chg >= 0

          return (
            <button
              key={item.sym}
              type="button"
              onClick={() => onSelect(item)}
              className={[
                'grid h-[46px] w-full grid-cols-[minmax(0,1fr)_74px] items-center gap-2 border-b border-border bg-panel px-3 text-left transition-colors hover:bg-hover',
                active ? 'border-l-2 border-l-accent bg-surface pl-[10px]' : 'border-l-2 border-l-transparent',
              ].join(' ')}
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12px] font-medium leading-4 text-primary">{item.sym}</span>
                <span className="block truncate text-[10px] leading-3 text-muted">{item.name}</span>
              </span>
              <span className="min-w-0 text-right">
                <span className="block font-mono text-[12px] leading-4 text-primary">{formatPrice(item.price)}</span>
                <span className={`block font-mono text-[10px] leading-3 ${positive ? 'text-up' : 'text-dn'}`}>
                  {positive ? '+' : ''}{item.chg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}%
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
