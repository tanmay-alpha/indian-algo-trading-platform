'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { WatchlistRow } from '@/components/ui-maet/watchlist-row'
import { Skeleton } from '@/components/ui-maet/skeleton'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { useToast } from '@/components/ui-maet/toast'
import { searchInstruments } from '@/lib/api'
import type { Instrument } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'

type WatchlistTab = 'my' | 'indices' | 'nifty'

interface WatchlistScreenProps {
  onNavigate?: (tab: AppTab) => void
}

export function WatchlistScreen({ onNavigate }: WatchlistScreenProps) {
  const { pushToast } = useToast()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<WatchlistTab>('nifty')
  const [searchResults, setSearchResults] = useState<Instrument[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const watchlistLoading = useTerminalStore((s) => s.watchlistLoading)
  const watchlistError = useTerminalStore((s) => s.watchlistError)
  const watchlistGroups = useTerminalStore((s) => s.watchlistGroups)
  const marketWatch = useTerminalStore((s) => s.marketWatch)
  const indices = useTerminalStore((s) => s.indices)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const setSelectedInstrument = useTerminalStore((s) => s.setSelectedInstrument)
  const addSymbol = useTerminalStore((s) => s.addSymbolToBackend)
  const removeSymbol = useTerminalStore((s) => s.removeSymbolFromBackend)

  const marketDataUnavailable = apiStatus !== 'ONLINE'
  const showSearchResults = query.trim().length >= 2

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
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchInstruments(trimmed)
        if (!cancelled) setSearchResults(results)
      } catch {
        if (!cancelled) setSearchError('Instrument search is paused. Try again when the connection is ready.')
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const rows = useMemo(() => {
    if (activeTab === 'indices') {
      return indices.map((item) => ({
        symbol: item.symbol,
        name: item.name ?? item.symbol,
        exchange: item.exchange ?? 'NSE',
        token: item.token ?? null,
        ltp: item.ltp,
        change_pct: item.change_pct,
        volume: null,
      }))
    }

    const groupId = activeTab === 'my' ? 'mine' : 'nifty50'
    const group = watchlistGroups.find((item) => item.id === groupId) ?? watchlistGroups[0]
    const symbols = group?.symbols ?? []
    return symbols.map((symbol) => {
      const tick = marketWatch[symbol]
      return {
        symbol,
        name: tick?.name ?? symbol.replace(/-EQ$/, ''),
        exchange: tick?.exchange ?? 'NSE',
        token: tick?.token ?? null,
        ltp: tick?.ltp ?? null,
        change_pct: tick?.change_pct ?? null,
        volume: tick?.volume ?? null,
      }
    })
  }, [activeTab, indices, marketWatch, watchlistGroups])

  const openChart = (
    symbol: string,
    exchange: string,
    name?: string,
    token?: string | null,
    source: 'search' | 'watchlist' | 'market-watch' = 'watchlist'
  ) => {
    setSelectedInstrument(symbol, exchange, name, token, source)
    onNavigate?.('chart')
  }

  const addResult = async (instrument: Instrument) => {
    await addSymbol(instrument.symbol, instrument.exchange)
    pushToast({
      type: 'info',
      title: 'Symbol added',
      body: `${instrument.symbol} is saved locally${marketDataUnavailable ? ' while quotes are waiting.' : '.'}`,
    })
  }

  const removeRow = async (symbol: string) => {
    await removeSymbol(symbol)
    pushToast({ type: 'warning', title: 'Symbol removed', body: `${symbol} removed from the active watchlist.` })
  }

  return (
    <div className="flex h-full flex-col pb-4">
      <div className="shrink-0 px-3 pt-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-maet-text">Watchlist</h1>
            <p className="text-sm text-maet-text-muted">Search Indian equities and open the chart workspace.</p>
          </div>
          <button
            type="button"
            onClick={() => setQuery((current) => current || 'RELIANCE')}
            className="glass-button h-9 min-h-9 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Symbol
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-maet-text-muted" />
          <input
            type="text"
            placeholder="Search NSE/BSE symbol or company"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="maet-input pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear symbol search"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-maet-text-muted hover:bg-maet-elevated hover:text-maet-text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!showSearchResults && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-3 no-scrollbar">
            <TabButton active={activeTab === 'nifty'} label="Nifty 50" onClick={() => setActiveTab('nifty')} />
            <TabButton active={activeTab === 'indices'} label="Indices" onClick={() => setActiveTab('indices')} />
            <TabButton active={activeTab === 'my'} label="My List" onClick={() => setActiveTab('my')} />
          </div>
        )}
      </div>

      {!showSearchResults && marketDataUnavailable && (
        <div className="mx-3 mb-3 shrink-0 rounded-lg border border-maet-amber/25 bg-maet-amber/10 px-3 py-2 text-xs font-semibold text-maet-amber backdrop-blur-xl">
          Quotes may be waiting outside market/feed conditions.
        </div>
      )}

      {watchlistError && (
        <div className="mx-3 mb-3 shrink-0 rounded-lg border border-maet-amber/25 bg-maet-amber/10 px-3 py-2 text-xs font-semibold text-maet-amber backdrop-blur-xl">
          {watchlistError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {showSearchResults ? (
          <div className="space-y-1.5">
            <div className="mb-2 text-xs font-bold uppercase text-maet-text-muted">Search results</div>
            {isSearching && <SkeletonRows count={3} />}
            {searchError && !isSearching && (
              <EmptySearch message={searchError} />
            )}
            {!isSearching && !searchError && searchResults.length === 0 && (
              <EmptySearch message="Search NSE/BSE symbols to build your workspace." />
            )}
            {!isSearching && !searchError && searchResults.map((instrument) => {
              const alreadyAdded = rows.some((row) => row.symbol === instrument.symbol)
              return (
                <div key={`${instrument.exchange}-${instrument.token}-${instrument.symbol}`} className="reflection-card grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => openChart(instrument.symbol, instrument.exchange, instrument.name, instrument.token, 'search')}
                    className="min-w-0 text-left"
                    aria-label={`Open chart for ${instrument.symbol}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-mono text-sm font-bold text-maet-text">{instrument.symbol}</span>
                      <StatusBadge tone="muted" className="min-h-6 px-1.5 text-xs">{instrument.exchange}</StatusBadge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-maet-text-muted">{instrument.name}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void addResult(instrument)}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold',
                      alreadyAdded ? 'border border-maet-green/30 bg-maet-green/10 text-maet-green' : 'border border-maet-border bg-maet-elevated text-maet-text-secondary hover:text-maet-text'
                    )}
                  >
                    {alreadyAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {alreadyAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : watchlistLoading ? (
          <div>
            <MarketHeader />
            <SkeletonRows count={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="reflection-card grid min-h-[260px] place-items-center p-6 text-center">
            <div>
              <Search className="mx-auto h-6 w-6 text-maet-text-muted" />
            <div className="mt-3 text-sm font-bold text-maet-text">Search NSE/BSE symbols to build your workspace.</div>
              <p className="mt-1 text-xs text-maet-text-secondary">Tap a result to open the chart workspace or save it to your list.</p>
            </div>
          </div>
        ) : (
          <div>
            <MarketHeader />
            {rows.map((row) => (
              <WatchlistRow
                key={row.symbol}
                symbol={row.symbol}
                name={row.name}
                exchange={row.exchange}
                price={row.ltp}
                changePct={row.change_pct}
                volume={row.volume}
                offline={marketDataUnavailable}
                subscribed={!marketDataUnavailable}
                selected={selectedSymbol === row.symbol}
                onOpen={() => openChart(row.symbol, row.exchange, row.name, row.token, 'watchlist')}
                onRemove={activeTab !== 'indices' ? () => void removeRow(row.symbol) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('filter-chip', active && 'active')}>
      {label}
    </button>
  )
}

function MarketHeader() {
  return (
    <div className="grid h-5 grid-cols-[minmax(0,1fr)_68px_48px_36px] items-center gap-2 border-b border-border/60 px-2 font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)]">
      <span>INSTRUMENT</span>
      <span className="text-right">LTP</span>
      <span className="text-right">CHG%</span>
      <span className="text-right">VOL</span>
    </div>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="grid h-8 grid-cols-[minmax(0,1fr)_68px_48px_36px] items-center gap-2 border-b border-border/60 px-2">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="ml-auto h-3 w-14" />
          <Skeleton className="ml-auto h-2.5 w-9" />
          <Skeleton className="ml-auto h-2.5 w-7" />
        </div>
      ))}
    </div>
  )
}

function EmptySearch({ message }: { message: string }) {
  return (
    <div className="reflection-card p-6 text-center">
      <Search className="mx-auto h-6 w-6 text-maet-text-muted" />
      <div className="mt-3 text-sm font-bold text-maet-text">{message}</div>
    </div>
  )
}
