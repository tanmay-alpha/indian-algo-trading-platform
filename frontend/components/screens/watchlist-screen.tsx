'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X, Plus, Check, Loader2 } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import type { MarketWatchRow, Instrument } from '@/lib/types'
import { StockRow } from '@/components/ui-maet/stock-row'
import { EmptyState } from '@/components/ui-maet/empty-state'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { searchInstruments } from '@/lib/api'

const FILTERS = ['All', 'NSE', 'BSE'] as const
type Filter = typeof FILTERS[number]

interface WatchlistScreenProps {
  onNavigate?: (tab: AppTab) => void
}

export function WatchlistScreen({ onNavigate }: WatchlistScreenProps) {
  const [query, setQuery]     = useState('')
  const [filter, setFilter]   = useState<Filter>('All')

  // Search state
  const [searchResults, setSearchResults] = useState<Instrument[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const marketWatch    = useTerminalStore((s) => s.marketWatch)
  const watchlistSource = useTerminalStore((s) => s.watchlistSource)
  const setSelected     = useTerminalStore((s) => s.setSelectedSymbol)
  const selectedSymbol  = useTerminalStore((s) => s.selectedSymbol)

  // Watchlist Actions and States
  const addSymbol = useTerminalStore((s) => s.addSymbolToBackend)
  const removeSymbol = useTerminalStore((s) => s.removeSymbolFromBackend)
  const watchlistAdminRequired = useTerminalStore((s) => s.watchlistAdminRequired)
  const watchlistError = useTerminalStore((s) => s.watchlistError)
  const watchlistGroupId = useTerminalStore((s) => s.watchlistGroupId)
  const watchlistGroups = useTerminalStore((s) => s.watchlistGroups)

  const activeGroup = useMemo(() => {
    return watchlistGroups.find((g) => g.id === watchlistGroupId) ?? watchlistGroups[0]
  }, [watchlistGroups, watchlistGroupId])

  const isInWatchlist = (symbol: string) => {
    return activeGroup?.symbols.includes(symbol) ?? false
  }

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      setSearchError(null)
      return
    }

    let cancelled = false
    setIsSearching(true)
    setSearchError(null)

    const timer = setTimeout(async () => {
      try {
        const results = await searchInstruments(trimmed)
        if (!cancelled) {
          setSearchResults(results)
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError('Search failed — backend offline')
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // Derive display rows from market watch data
  const rows: MarketWatchRow[] = useMemo(() => {
    return Object.values(marketWatch ?? {})
  }, [marketWatch])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (query.trim() && query.trim().length < 2) {
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

  const isBackendConnected = watchlistSource === 'db'
  const showSearchResults = query.trim().length >= 2

  return (
    <div className="flex flex-col h-full pb-4">
      {/* Search Bar */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint" />
          <input
            type="text"
            placeholder="Search & add instruments…"
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

      {/* Admin required warning */}
      {watchlistAdminRequired && (
        <div className="mx-4 mb-3 shrink-0 px-3 py-2 rounded-xl bg-down/10 border border-down/20 text-xs text-down font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-down shrink-0 animate-pulse" />
            <span>Admin unlock required to persist changes.</span>
          </div>
          <button
            onClick={() => onNavigate?.('portfolio')}
            className="text-[10px] px-2.5 py-1 rounded bg-down/20 text-down hover:bg-down/30 font-bold transition-all"
            type="button"
          >
            Unlock
          </button>
        </div>
      )}

      {/* Watchlist Error */}
      {watchlistError && (
        <div className="mx-4 mb-3 shrink-0 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] text-[#F59E0B] font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
          {watchlistError}
        </div>
      )}

      {/* Filter chips (Only show when not showing backend search results) */}
      {!showSearchResults && (
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
      )}

      {/* Data source note */}
      {!isBackendConnected && (
        <div className="mx-4 mb-3 shrink-0 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] text-[#F59E0B] font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
          Backend API not loaded. Showing standard client-side instrument list.
        </div>
      )}

      {/* List / Search Results */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        <SectionTitle title={showSearchResults ? "Search Results" : "Instruments Feed"} />

        {showSearchResults ? (
          <div className="space-y-2">
            {isSearching && (
              <div className="flex items-center justify-center py-8 text-text-dim gap-2 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-[#22D3EE]" />
                Searching instrument universe...
              </div>
            )}

            {searchError && !isSearching && (
              <div className="text-center py-6 text-xs text-down font-medium">
                {searchError}
              </div>
            )}

            {!isSearching && !searchError && searchResults.length === 0 && (
              <EmptyState
                title="No Matches Found"
                hint="Try typing another symbol name or instrument code like RELIANCE, TCS, or SBIN."
                icon={<Search className="w-5 h-5 text-text-dim" />}
              />
            )}

            {!isSearching && !searchError && searchResults.map((r) => (
              <div
                key={`${r.token || r.symbol}-${r.symbol}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] transition-all duration-150 hover:bg-white/[0.025]"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text tracking-wide truncate">{r.symbol}</span>
                    <span className="text-[9px] font-mono font-semibold px-1 py-0.25 rounded bg-white/[0.06] text-text-dim border border-white/[0.04] uppercase shrink-0">
                      {r.exchange}
                    </span>
                  </div>
                  {r.name && <span className="text-[10px] text-text-faint mt-0.5 truncate max-w-[200px]">{r.name}</span>}
                </div>

                <button
                  onClick={() => {
                    if (isInWatchlist(r.symbol)) {
                      void removeSymbol(r.symbol)
                    } else {
                      void addSymbol(r.symbol, r.exchange)
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98]",
                    isInWatchlist(r.symbol)
                      ? "bg-[#16C784]/15 text-[#16C784] hover:bg-[#16C784]/25"
                      : "bg-[#22D3EE]/15 text-[#22D3EE] hover:bg-[#22D3EE]/25"
                  )}
                  type="button"
                >
                  {isInWatchlist(r.symbol) ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Normal Watchlist View */
          filtered.length === 0 ? (
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
          )
        )}
      </div>
    </div>
  )
}

