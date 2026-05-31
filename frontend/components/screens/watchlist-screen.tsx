'use client'

import { useState, useMemo } from 'react'
import { Search, X, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import type { MarketWatchRow } from '@/lib/types'

const FILTERS = ['All', 'NSE', 'BSE', 'Favorites'] as const
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
    <div className="flex flex-col h-full">
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
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-2 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('filter-chip', filter === f && 'active')}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Data source note */}
      {!isBackendConnected && (
        <div className="mx-4 mb-2 shrink-0 px-3 py-2 rounded-xl bg-warn/5 border border-warn/15 text-xs text-warn flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-warn/70 shrink-0" />
          No live watchlist data connected. Backend API required for real-time prices.
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        {!isEmpty && (
          <div className="flex items-center px-4 py-1.5 border-b border-border/50 bg-bg-2/50 sticky top-0 z-10">
            <div className="flex-1 text-[10px] font-medium text-text-faint uppercase tracking-wider">Instrument</div>
            <div className="w-24 text-right text-[10px] font-medium text-text-faint uppercase tracking-wider">LTP</div>
            <div className="w-16 text-right text-[10px] font-medium text-text-faint uppercase tracking-wider">Chg%</div>
          </div>
        )}

        {isEmpty ? (
          <EmptyState
            connected={isBackendConnected}
            hasQuery={query.length > 0}
          />
        ) : (
          <div>
            {filtered.map((row) => (
              <WatchlistRow
                key={row.symbol}
                row={row}
                onClick={() => handleRowClick(row.symbol)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WatchlistRow({ row, onClick }: { row: MarketWatchRow; onClick: () => void }) {
  const ltp      = row.ltp
  const chgPct   = row.change_pct
  const hasData  = ltp != null
  const isUp     = (chgPct ?? 0) > 0
  const isDown   = (chgPct ?? 0) < 0

  const clean = row.symbol.split(':').pop()?.split('-')[0] ?? row.symbol

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-4 h-16 border-b border-border/40 hover:bg-white/[0.02] active:bg-info/5 transition-colors text-left"
    >
      {/* Status dot */}
      <div className={cn(
        'w-1.5 h-1.5 rounded-full mr-3 shrink-0',
        hasData ? (isUp ? 'bg-up' : isDown ? 'bg-down' : 'bg-text-dim') : 'bg-text-faint/40'
      )} />

      {/* Symbol & Name */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text leading-tight tracking-wide">
          {clean}
        </div>
        <div className="text-xs text-text-faint leading-tight truncate mt-0.5">
          {row.name ?? row.exchange ?? ''}
        </div>
      </div>

      {/* LTP */}
      <div className="w-24 text-right">
        {hasData ? (
          <div className={cn('text-sm font-semibold tabular-nums', isUp ? 'text-up' : isDown ? 'text-down' : 'text-text')}>
            ₹{ltp!.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ) : (
          <div className="text-xs text-text-faint font-mono">—</div>
        )}
      </div>

      {/* Change% */}
      <div className="w-16 text-right">
        {chgPct != null ? (
          <div className={cn(
            'text-xs font-medium tabular-nums flex items-center justify-end gap-0.5',
            isUp ? 'text-up' : isDown ? 'text-down' : 'text-text-dim'
          )}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {isUp ? '+' : ''}{chgPct.toFixed(2)}%
          </div>
        ) : (
          <div className="text-xs text-text-faint font-mono text-right">—</div>
        )}
      </div>
    </button>
  )
}

function EmptyState({ connected, hasQuery }: { connected: boolean; hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Search className="w-8 h-8 text-text-faint mb-3" />
        <div className="text-sm font-medium text-text-2">No results found</div>
        <div className="text-xs text-text-faint mt-1">Try a different symbol name</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-info/10 border border-info/20 flex items-center justify-center mb-3">
        <Search className="w-6 h-6 text-info" />
      </div>
      <div className="text-sm font-semibold text-text-2 mb-1">
        {connected ? 'Watchlist is empty' : 'Backend not connected'}
      </div>
      <div className="text-xs text-text-faint max-w-[220px] leading-relaxed">
        {connected
          ? 'Search instruments above to build your watchlist. Live prices require market feed.'
          : 'Watchlist data requires backend API. Connect the backend to load real instrument prices.'}
      </div>
    </div>
  )
}
