'use client'

import { X, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, fmtPct, fmtVolume, priceDirClass, fmtAge } from '@/lib/utils'
import { PriceCell } from './price-cell'
import { DataQualityBadge } from './data-quality-badge'
import { InstrumentSearch } from './instrument-search'
import { EmptyState } from './empty-state'
import type { DataQuality } from '@/lib/types'

export function WatchlistPanel() {
  const groups = useTerminalStore((s) => s.watchlistGroups)
  const groupId = useTerminalStore((s) => s.watchlistGroupId)
  const setGroup = useTerminalStore((s) => s.setWatchlistGroup)
  const market = useTerminalStore((s) => s.marketWatch)
  const lastBy = useTerminalStore((s) => s.lastTickBySymbol)
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const setSelected = useTerminalStore((s) => s.setSelectedSymbol)
  const addToWatchlist = useTerminalStore((s) => s.addToWatchlist)
  const removeFromWatchlist = useTerminalStore((s) => s.removeFromWatchlist)
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const backendOffline = useTerminalStore((s) => s.backendOffline)

  const [groupOpen, setGroupOpen] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node))
        setGroupOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Refresh ages every second
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const activeGroup = groups.find((g) => g.id === groupId) ?? groups[0]
  const symbols = activeGroup ? activeGroup.symbols : []

  return (
    <aside
      aria-label="Watchlist"
      className="w-watchlist shrink-0 h-full bg-bg-2 border-r border-border flex flex-col"
    >
      {/* Group selector */}
      <div className="h-9 px-2 flex items-center gap-2 border-b border-border">
        <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint">
          GRP
        </span>
        <div ref={groupRef} className="relative flex-1">
          <button
            onClick={() => setGroupOpen((v) => !v)}
            className="w-full h-6 px-2 flex items-center justify-between rounded-sm border border-border bg-panel hover:border-border-strong text-xs font-mono text-text"
          >
            <span>{activeGroup?.name ?? '—'}</span>
            <ChevronDown className="w-3 h-3 text-text-dim" />
          </button>
          {groupOpen && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-panel-2 border border-border-strong rounded-sm shadow-modal py-0.5">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGroup(g.id)
                    setGroupOpen(false)
                  }}
                  className={cn(
                    'w-full px-2.5 h-7 flex items-center justify-between text-xs font-mono hover:bg-white/[0.04]',
                    g.id === groupId && 'bg-info/[0.06] text-info'
                  )}
                >
                  <span>{g.name}</span>
                  <span className="text-text-faint tnum">{g.symbols.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-[9px] font-mono text-text-faint tnum">
          {symbols.length}
        </span>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <InstrumentSearch
          onPick={(i) => addToWatchlist(i.symbol)}
          placeholder="Search & add to watchlist…"
        />
      </div>

      {/* Column headers */}
      <div className="h-6 px-2 flex items-center gap-2 border-b border-border bg-panel/40 text-[9px] font-mono uppercase tracking-wider text-text-faint">
        <span className="flex-1">SYMBOL</span>
        <span className="w-16 text-right">LTP</span>
        <span className="w-12 text-right">CHG%</span>
        <span className="w-10 text-right">VOL</span>
        <span className="w-7 text-right">AGE</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {symbols.length === 0 ? (
          <EmptyState
            title="WATCHLIST EMPTY"
            hint="Search above to add NSE / BSE instruments"
            compact
          />
        ) : (
          symbols.map((sym) => {
            const row = market[sym]
            const last = lastBy[sym] ?? null
            const age = last ? Date.now() - last : null
            const ltp = row?.ltp ?? null
            const chgPct = row?.change_pct ?? null
            const vol = row?.volume ?? null

            const quality: DataQuality = backendOffline
              ? 'BACKEND OFFLINE'
              : !wsConnected
              ? 'UNAVAILABLE'
              : last == null
              ? 'UNAVAILABLE'
              : age! < 3000
              ? 'LIVE'
              : age! < 8000
              ? 'DELAYED'
              : 'STALE'

            const isSelected = selected === sym
            const isStale = quality === 'STALE' || quality === 'DELAYED'

            return (
              <div
                key={sym}
                onClick={() => setSelected(sym)}
                className={cn(
                  'group relative h-8 px-2 flex items-center gap-2 border-b border-border/40 cursor-pointer',
                  'hover:bg-white/[0.03] transition-colors',
                  isSelected && 'bg-info/[0.08]',
                  isStale && 'opacity-75'
                )}
              >
                {isSelected && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-info" />
                )}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="text-xs font-mono text-text truncate">
                    {sym}
                  </span>
                  <DataQualityBadge quality={quality} showDot={false} />
                </div>
                <PriceCell
                  value={ltp}
                  className={cn(
                    'w-16 text-right text-xs',
                    ltp == null && 'text-text-faint'
                  )}
                />
                <span
                  className={cn(
                    'w-12 text-right text-2xs font-mono tnum',
                    chgPct == null ? 'text-text-faint' : priceDirClass(chgPct)
                  )}
                >
                  {fmtPct(chgPct)}
                </span>
                <span className="w-10 text-right text-2xs font-mono tnum text-text-2">
                  {fmtVolume(vol)}
                </span>
                <span className="w-7 text-right text-2xs font-mono tnum text-text-faint">
                  {fmtAge(age)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromWatchlist(sym)
                  }}
                  aria-label={`Remove ${sym}`}
                  className="opacity-0 group-hover:opacity-100 absolute right-1 p-0.5 text-text-dim hover:text-down"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
