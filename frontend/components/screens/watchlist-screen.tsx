'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X, Plus, Check, BarChart2 } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import type { Instrument } from '@/lib/types'
import { StockRow } from '@/components/ui-maet/stock-row'
import { EmptyState } from '@/components/ui-maet/empty-state'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { searchInstruments } from '@/lib/api'
import { ShimmerSkeleton } from '@/components/effects/shimmer-skeleton'

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

  // Store state
  const marketWatch             = useTerminalStore((s) => s.marketWatch)
  const watchlistSource         = useTerminalStore((s) => s.watchlistSource)
  const persistentWatchlistItems = useTerminalStore((s) => s.persistentWatchlistItems)
  const watchlistLoading        = useTerminalStore((s) => s.watchlistLoading)
  const setSelectedInstrument   = useTerminalStore((s) => s.setSelectedInstrument)
  const selectedSymbol          = useTerminalStore((s) => s.selectedSymbol)

  // Watchlist Actions and States
  const addSymbol              = useTerminalStore((s) => s.addSymbolToBackend)
  const removeSymbol           = useTerminalStore((s) => s.removeSymbolFromBackend)
  const watchlistAdminRequired = useTerminalStore((s) => s.watchlistAdminRequired)
  const watchlistError         = useTerminalStore((s) => s.watchlistError)
  const watchlistGroupId       = useTerminalStore((s) => s.watchlistGroupId)
  const watchlistGroups        = useTerminalStore((s) => s.watchlistGroups)

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
      } catch {
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

  // Build display rows:
  // - When backend is connected (watchlistSource === 'db'), use persistentWatchlistItems
  //   merged with backend tick data from marketWatch for LTP/change.
  // - Otherwise fall back to marketWatch rows.
  const rows = useMemo(() => {
    if (watchlistSource === 'db' && persistentWatchlistItems.length > 0) {
      return persistentWatchlistItems.map((item) => {
        const tick = marketWatch[item.symbol] ?? null
        return {
          symbol:     item.symbol,
          name:       item.symbol,  // backend doesn't return name in watchlist item
          exchange:   item.exchange ?? 'NSE',
          token:      item.token,
          ltp:        tick?.ltp ?? item.ltp ?? null,
          change_pct: tick?.change_pct ?? null,
          stale:      tick == null,
          source:     'db' as const,
        }
      })
    }
    // Fallback: market-watch rows (populated by WS tick ingest)
    return Object.values(marketWatch ?? {}).map((r) => ({
      symbol:     r.symbol,
      name:       r.name ?? r.symbol,
      exchange:   r.exchange ?? 'NSE',
      token:      r.token,
      ltp:        r.ltp ?? null,
      change_pct: r.change_pct ?? null,
      stale:      r.stale ?? false,
      source:     'fallback' as const,
    }))
  }, [watchlistSource, persistentWatchlistItems, marketWatch])

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

  // Navigate to chart with full instrument context
  const handleRowClick = (symbol: string, exchange: string, name?: string) => {
    setSelectedInstrument(symbol, exchange, name)
    onNavigate?.('chart')
  }

  // Navigate to chart from search result (without adding to watchlist)
  const handleSearchRowChart = (instrument: Instrument) => {
    setSelectedInstrument(instrument.symbol, instrument.exchange, instrument.name)
    setQuery('')
    onNavigate?.('chart')
  }

  const isBackendConnected = watchlistSource === 'db'
  const showSearchResults  = query.trim().length >= 2

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
      {!isBackendConnected && !watchlistLoading && (
        <div className="mx-4 mb-3 shrink-0 px-3 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] text-[#F59E0B] font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
          Backend not connected. Quotes remain blank until REST or WebSocket data is available.
        </div>
      )}

      {/* Loading state */}
      {watchlistLoading && (
        <div className="mx-4 space-y-2.5 py-2 flex-1 overflow-y-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] flex justify-between items-center">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <ShimmerSkeleton width="w-24" height="h-3.5" />
                  <ShimmerSkeleton width="w-8" height="h-3" />
                </div>
                <ShimmerSkeleton width="w-32" height="h-2.5" />
              </div>
              <div className="text-right space-y-2 shrink-0">
                <ShimmerSkeleton width="w-16" height="h-3.5" />
                <ShimmerSkeleton width="w-12" height="h-2.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List / Search Results */}
      {!watchlistLoading && (
        <div className="flex-1 overflow-y-auto px-4 space-y-2">
          <SectionTitle title={showSearchResults ? "Search Results" : "INSTRUMENTS FEED"} />

          {showSearchResults ? (
            <div className="space-y-2">
              {isSearching && (
                <div className="space-y-2.5 py-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] flex justify-between items-center">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <ShimmerSkeleton width="w-24" height="h-3.5" />
                          <ShimmerSkeleton width="w-8" height="h-3" />
                        </div>
                        <ShimmerSkeleton width="w-32" height="h-2.5" />
                      </div>
                      <div className="text-right space-y-2 shrink-0">
                        <ShimmerSkeleton width="w-16" height="h-3.5" />
                        <ShimmerSkeleton width="w-12" height="h-2.5" />
                      </div>
                    </div>
                  ))}
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
                  {/* Left: symbol info — tap to view chart */}
                  <button
                    className="flex flex-col min-w-0 flex-1 text-left"
                    type="button"
                    onClick={() => handleSearchRowChart(r)}
                    aria-label={`View ${r.symbol} chart`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-text tracking-wide truncate">{r.symbol}</span>
                      <span className="text-xs font-mono font-semibold px-1 py-0.25 rounded bg-white/[0.06] text-text-dim border border-white/[0.04] uppercase shrink-0">
                        {r.exchange}
                      </span>
                    </div>
                    {r.name && <span className="text-[10px] text-text-faint mt-0.5 truncate max-w-[180px]">{r.name}</span>}
                  </button>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {/* View Chart button */}
                    <button
                      onClick={() => handleSearchRowChart(r)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-[#22D3EE]/10 text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-all duration-150"
                      type="button"
                      title="View chart for this instrument"
                      aria-label={`View ${r.symbol} chart`}
                    >
                      <BarChart2 className="w-3 h-3" />
                      Chart
                    </button>

                    {/* Add/Remove from watchlist */}
                    <button
                      onClick={() => {
                        if (isInWatchlist(r.symbol)) {
                          void removeSymbol(r.symbol)
                        } else {
                          void addSymbol(r.symbol, r.exchange)
                        }
                      }}
                      aria-label={isInWatchlist(r.symbol) ? `Remove ${r.symbol} from watchlist` : `Add ${r.symbol} to watchlist`}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all duration-150 active:scale-[0.98]",
                        isInWatchlist(r.symbol)
                          ? "bg-[#16C784]/15 text-[#16C784] hover:bg-[#16C784]/25"
                          : "bg-white/[0.06] text-text-dim hover:bg-white/[0.1]"
                      )}
                      type="button"
                    >
                      {isInWatchlist(r.symbol) ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
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
                      price={row.ltp ?? null}
                      change={row.change_pct ?? null}
                      isSelected={selectedSymbol === row.symbol}
                      onClick={() => handleRowClick(row.symbol, row.exchange, row.name)}
                    />
                  )
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
