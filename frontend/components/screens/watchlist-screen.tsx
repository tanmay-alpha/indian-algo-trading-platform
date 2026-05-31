'use client'

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import type { MarketWatchRow } from '@/lib/types'
import { StockRow } from '@/components/ui-maet/stock-row'
import { EmptyState } from '@/components/ui-maet/empty-state'
import { SectionTitle } from '@/components/ui-maet/section-title'

const FILTERS = ['All', 'NSE', 'BSE'] as const
type Filter = typeof FILTERS[number]

interface WatchlistScreenProps {
  onNavigate?: (tab: AppTab) => void
}

export function WatchlistScreen({ onNavigate }: WatchlistScreenProps) {
  const [query, setQuery]     = useState('')
  const [filter, setFilter]   = useState<Filter>('All')

  const marketWatch    = useTerminalStore((s) => s.marketWatch)
  const watchlistSource = useTerminalStore((s) => s.watchlistSource)
  const setSelected     = useTerminalStore((s) => s.setSelectedSymbol)
  const selectedSymbol  = useTerminalStore((s) => s.selectedSymbol)

  // Derive display rows from market watch data
  const rows: MarketWatchRow[] = useMemo(() => {
    return Object.values(marketWatch ?? {})
  }, [marketWatch])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (query.trim()) {
        const q = query.toLowerCase()
        if (!r.symbol.toLowerCase().includes(q) && !(r.name ?? '').toLowerCase().includes(q)) {
          return false
        }
      }
      if (filter === 'NSE' && r.exchange !== 'NSE') return false
      if (filter === 'BSE' && r.exchange !== 'BSE') return false
      return true
    })
  }, [rows, query, filter])

  const handleRowClick = (symbol: string) => {
    setSelected(symbol)
    onNavigate?.('chart')
  }

  const isEmpty = filtered.length === 0
  const isBackendConnected = watchlistSource === 'db'

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Search Bar */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint" />
          <input
            type="text"
            placeholder="Search NSE/BSE instruments…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="maet-input pl-9 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-3 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150',
              filter === f 
                ? 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/30' 
                : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
            )}
            type="button"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Data source note */}
      {!isBackendConnected && (
        <div className="mx-4 mb-3 shrink-0 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] text-[#F59E0B] font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
          Backend API not loaded. Showing standard client-side instrument list.
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        <SectionTitle title="Instruments Feed" />

        {isEmpty ? (
          <EmptyState
            title={query ? "No Search Results" : "Watchlist Empty"}
            hint={query ? "Try searching for a different instrument code like RELIANCE, TCS, or SBIN." : "Connect to backend or add items to see active quotes."}
            icon={<Search className="w-5 h-5 text-text-dim" />}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => {
              const cleanSymbol = row.symbol.split(':').pop()?.split('-')[0] ?? row.symbol
              return (
                <StockRow
                  key={row.symbol}
                  symbol={cleanSymbol}
                  name={row.name}
                  exchange={row.exchange}
                  price={row.ltp ?? 0}
                  change={row.change_pct ?? 0}
                  isSelected={selectedSymbol === row.symbol}
                  onClick={() => handleRowClick(row.symbol)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
