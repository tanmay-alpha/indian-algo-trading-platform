'use client'

import { useState, useCallback } from 'react'
import { Search, X, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { searchInstruments } from '@/lib/api'
import { formatPrice, cn } from '@/lib/utils'
import type { Instrument, WatchlistItem } from '@/lib/types'
import { DEFAULT_WATCHLIST } from '@/lib/constants'

export function WatchlistPanel() {
  const { watchlist, currentTick, addToWatchlist, removeFromWatchlist } = useTerminalStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Instrument[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Initialize with default watchlist if empty
  const displayWatchlist = watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST.map((item) => ({
    ...item,
    ltp: 0,
    change: 0,
    changePercent: 0,
  }))

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchInstruments(query)
      setSearchResults(results.slice(0, 8))
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleAddToWatchlist = (instrument: Instrument) => {
    const item: WatchlistItem = {
      symbol: instrument.symbol,
      token: instrument.token,
      name: instrument.name,
      ltp: 0,
      change: 0,
      changePercent: 0,
    }
    addToWatchlist(item)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div className="h-full flex flex-col glass border-r border-border">
      {/* Search Header */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
          <input
            type="text"
            placeholder="Search instruments..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-black/20 border border-border rounded text-sm font-mono placeholder:text-text-dim focus:outline-none focus:border-accent/50"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-50 left-3 right-3 mt-1 bg-panel-solid border border-border rounded shadow-xl max-h-64 overflow-y-auto">
            {searchResults.map((instrument) => (
              <button
                key={instrument.token}
                onClick={() => handleAddToWatchlist(instrument)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 text-left"
              >
                <div>
                  <div className="text-sm font-medium">{instrument.symbol}</div>
                  <div className="text-xs text-text-dim truncate">{instrument.name}</div>
                </div>
                <Plus className="w-4 h-4 text-accent shrink-0" />
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="absolute z-50 left-3 right-3 mt-1 bg-panel-solid border border-border rounded p-3 text-center text-sm text-text-dim">
            Searching...
          </div>
        )}
      </div>

      {/* Watchlist Title */}
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] text-text-dim uppercase tracking-wider font-medium">
          Watchlist
        </span>
      </div>

      {/* Watchlist Items */}
      <div className="flex-1 overflow-y-auto">
        {displayWatchlist.map((item) => {
          const isActive = currentTick?.symbol === item.symbol
          const price = isActive && currentTick ? currentTick.price : item.ltp
          const change = item.changePercent
          const isPositive = change > 0
          const isNegative = change < 0

          return (
            <div
              key={item.symbol}
              className={cn(
                'group px-3 py-2.5 flex items-center justify-between border-b border-border/50 hover:bg-white/5 transition-colors',
                isActive && 'bg-accent/5 border-l-2 border-l-accent'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.symbol}</span>
                  {isActive && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent uppercase">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-dim truncate">{item.name}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-sm font-medium">
                    {price > 0 ? formatPrice(price) : '--'}
                  </div>
                  <div
                    className={cn(
                      'flex items-center justify-end gap-0.5 text-[10px] font-mono',
                      isPositive && 'text-success',
                      isNegative && 'text-danger',
                      !isPositive && !isNegative && 'text-text-dim'
                    )}
                  >
                    {isPositive && <TrendingUp className="w-2.5 h-2.5" />}
                    {isNegative && <TrendingDown className="w-2.5 h-2.5" />}
                    {!isPositive && !isNegative && <Minus className="w-2.5 h-2.5" />}
                    <span>{change !== 0 ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '--'}</span>
                  </div>
                </div>

                <button
                  onClick={() => removeFromWatchlist(item.symbol)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-text-dim hover:text-danger transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
