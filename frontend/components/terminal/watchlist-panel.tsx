'use client'

import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DataQuality } from '@/lib/types'
import { cn, fmtAge, fmtPct, fmtVolume, priceDirClass } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'
import { DataQualityBadge } from './data-quality-badge'
import { EmptyState } from './empty-state'
import { InstrumentSearch } from './instrument-search'
import { PriceCell } from './price-cell'

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
    const onClick = (event: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) {
        setGroupOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((count) => count + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const activeGroup = groups.find((group) => group.id === groupId) ?? groups[0]
  const symbols = activeGroup ? activeGroup.symbols : []

  return (
    <aside
      aria-label="Watchlist"
      className="w-watchlist shrink-0 h-full bg-bg-2 border-r border-border flex flex-col"
    >
      <div className="px-3 py-2 border-b border-border bg-panel/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-text">Market Watch</div>
            <div className="text-[10px] text-text-faint">NSE watchlists and live tick quality</div>
          </div>
          <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] font-mono text-text-dim">
            {symbols.length}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div ref={groupRef} className="relative w-32">
            <button
              onClick={() => setGroupOpen((open) => !open)}
              className="w-full h-7 px-2 flex items-center justify-between rounded-md border border-border bg-bg text-xs font-mono text-text hover:border-border-strong"
            >
              <span className="truncate">{activeGroup?.name ?? '—'}</span>
              <ChevronDown className="w-3 h-3 text-text-dim" />
            </button>
            {groupOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-panel-2 border border-border-strong rounded-md shadow-modal py-1">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setGroup(group.id)
                      setGroupOpen(false)
                    }}
                    className={cn(
                      'w-full px-2.5 h-7 flex items-center justify-between text-xs font-mono hover:bg-white/[0.04]',
                      group.id === groupId && 'bg-info/[0.06] text-info'
                    )}
                  >
                    <span className="truncate">{group.name}</span>
                    <span className="text-text-faint tnum">{group.symbols.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <InstrumentSearch
            onPick={(instrument) => addToWatchlist(instrument.symbol)}
            placeholder="Search NSE instruments"
            className="flex-1"
          />
        </div>
      </div>

      <div className="h-7 px-3 grid grid-cols-[1fr_72px_54px_44px] items-center gap-2 border-b border-border bg-bg text-[9px] font-mono uppercase tracking-wider text-text-faint">
        <span>Instrument</span>
        <span className="text-right">LTP</span>
        <span className="text-right">Chg%</span>
        <span className="text-right">Vol</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {symbols.length === 0 ? (
          <EmptyState
            title="Add symbols"
            hint="Search NSE instruments to build a watchlist. Market feed required for live ticks."
            icon={<Search className="w-6 h-6" />}
            compact
          />
        ) : (
          symbols.map((symbol) => {
            const row = market[symbol]
            const last = lastBy[symbol] ?? null
            const age = last ? Date.now() - last : null
            const quality = qualityForRow({ backendOffline, wsConnected, last, age })
            const isSelected = selected === symbol
            const ltp = row?.ltp ?? null
            const chgPct = row?.change_pct ?? null
            const volume = row?.volume ?? null
            const meta = row?.exchange
              ? `${row.exchange}${row.token ? ` / ${row.token}` : ''}`
              : last
              ? fmtAge(age)
              : 'No tick yet'

            return (
              <div
                key={symbol}
                onClick={() => setSelected(symbol)}
                className={cn(
                  'group relative min-h-[48px] px-3 py-2 grid grid-cols-[1fr_72px_54px_44px] items-center gap-2 border-b border-border/60 cursor-pointer',
                  'hover:bg-white/[0.035] transition-colors',
                  isSelected && 'bg-info/[0.08] shadow-[inset_2px_0_0_var(--info)]'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-text">{symbol}</span>
                    <DataQualityBadge quality={quality} showDot={false} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-faint">
                    <span className="truncate">{row?.name ?? meta}</span>
                    {!row?.name && <span className="text-text-dim">{meta}</span>}
                  </div>
                </div>
                <PriceCell
                  value={ltp}
                  className={cn('text-right text-xs', ltp == null && 'text-text-faint')}
                />
                <span
                  className={cn(
                    'text-right text-2xs font-mono tnum',
                    chgPct == null ? 'text-text-faint' : priceDirClass(chgPct)
                  )}
                >
                  {fmtPct(chgPct)}
                </span>
                <span className="text-right text-2xs font-mono tnum text-text-2">
                  {fmtVolume(volume)}
                </span>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    removeFromWatchlist(symbol)
                  }}
                  aria-label={`Remove ${symbol}`}
                  className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 rounded p-0.5 text-text-dim hover:text-down hover:bg-down-dim"
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

function qualityForRow({
  backendOffline,
  wsConnected,
  last,
  age,
}: {
  backendOffline: boolean
  wsConnected: boolean
  last: number | null
  age: number | null
}): DataQuality {
  if (backendOffline) return 'BACKEND OFFLINE'
  if (!wsConnected) return 'UNAVAILABLE'
  if (last == null || age == null) return 'UNAVAILABLE'
  if (age < 3000) return 'LIVE'
  if (age < 8000) return 'DELAYED'
  return 'STALE'
}
