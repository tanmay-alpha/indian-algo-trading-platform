'use client'

import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ApiStatus, DataQuality, NseMarketSession } from '@/lib/types'
import { cn, fmtAge, fmtVolume, getNseMarketSession, marketNoDataLabel, marketSessionLabel } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'
import { EmptyState } from './empty-state'
import { InstrumentSearch } from './instrument-search'

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
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const terminalStatus = useTerminalStore((s) => s.terminalStatus)

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
  const subscribedSymbols = new Set(
    Array.isArray(terminalStatus?.gateway?.subscribed_symbols)
      ? terminalStatus.gateway.subscribed_symbols.map((item) => normalizeWatchSymbol(String(item)))
      : []
  )
  const session = getNseMarketSession()
  const sessionMeta = marketSessionMeta(session)

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
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-text-faint">
              <span className={cn('h-1.5 w-1.5 rounded-full', sessionMeta.dotClass)} />
              <span>{sessionMeta.label}</span>
            </div>
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
              <span className="truncate">{activeGroup?.name ?? '\u2014'}</span>
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

      <div className="flex h-6 items-center border-b border-border bg-panel/50 px-2">
        <div className="flex-1 font-mono text-[9px] uppercase tracking-widest text-text-faint">INSTRUMENT</div>
        <div className="w-[68px] text-right font-mono text-[9px] tracking-wide text-text-faint">LTP</div>
        <div className="w-[48px] text-right font-mono text-[9px] tracking-wide text-text-faint">CHG%</div>
        <div className="w-[36px] text-right font-mono text-[9px] tracking-wide text-text-faint">VOL</div>
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
            const subscribed =
              subscribedSymbols.size === 0 || subscribedSymbols.has(normalizeWatchSymbol(symbol))
            const quality = qualityForRow({ apiStatus, last, age, subscribed })
            const isSelected = selected === symbol
            const ltp = row?.ltp ?? null
            const chgPct = row?.change_pct ?? null
            const volume = row?.volume ?? null
            const displayLtp = subscribed ? ltp : null
            const displayChgPct = subscribed ? chgPct : null
            const displayVolume = subscribed ? volume : null
            const displayName = row?.name ?? compactSymbolName(symbol)
            const cleanSymbol = compactSymbolName(symbol)
            const isLive = quality === 'LIVE'
            const isWaiting = subscribed && (quality === 'WAITING' || quality === 'WARMING')
            const statusLabel = !subscribed
              ? 'NO FEED'
              : isWaiting
              ? 'WAIT'
              : quality === 'STALE' || quality === 'DELAYED'
              ? quality
              : quality === 'PRE-MARKET' || quality === 'POST-MARKET' || quality === 'MARKET CLOSED'
              ? '—'
              : '—'
            const meta = row?.exchange
              ? `${row.exchange} EQ`
              : last
              ? fmtAge(age)
              : marketSessionLabel() === 'LIVE'
              ? 'Awaiting tick'
              : 'Market closed'

            return (
              <div
                key={symbol}
                onClick={() => setSelected(symbol)}
                className={cn(
                  'wl-row group relative flex h-[30px] cursor-pointer select-none items-center border-b border-border/50 px-2',
                  isSelected && 'selected'
                )}
              >
                <div
                  className={cn(
                    'mr-2 h-1.5 w-1.5 shrink-0 rounded-full',
                    isLive
                      ? 'bg-up animate-pulse-soft'
                      : isWaiting
                      ? 'bg-warn/60'
                      : 'bg-text-faint/40'
                  )}
                />

                <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] font-semibold tracking-wide text-text">
                    {cleanSymbol}
                  </span>
                  <span className="min-w-0 truncate text-[10px] text-text-faint">
                    {displayName || meta}
                  </span>
                </div>

                <div className="ml-1 flex shrink-0 items-baseline gap-2">
                  <span className={cn(
                    'w-[68px] text-right font-mono text-[12px] font-medium tabular-nums',
                    displayChgPct != null && displayChgPct > 0
                      ? 'text-up'
                      : displayChgPct != null && displayChgPct < 0
                      ? 'text-down'
                      : 'text-text-2'
                  )}>
                    {formatLtp(displayLtp)}
                  </span>
                  <span className={cn(
                    'w-[48px] text-right font-mono text-[10px] tabular-nums',
                    displayChgPct != null && displayChgPct > 0
                      ? 'text-up'
                      : displayChgPct != null && displayChgPct < 0
                      ? 'text-down'
                      : 'text-text-faint'
                  )}>
                    {formatChange(displayChgPct)}
                  </span>
                  <span className="w-[36px] text-right font-mono text-[10px] text-text-faint">
                    {displayVolume != null ? fmtVolume(displayVolume) : '—'}
                  </span>
                </div>

                {!isLive && (
                  <div className={cn(
                    'ml-1.5 shrink-0 rounded px-1 py-0.5 font-mono text-[9px] tracking-wide',
                    isWaiting
                      ? 'bg-warn/10 text-warn/70'
                      : !subscribed
                      ? 'bg-panel-3 text-text-faint'
                      : 'bg-panel-3 text-text-faint'
                  )}>
                    {statusLabel}
                  </div>
                )}

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
        {symbols.length > 0 && !terminalStatus && apiStatus !== 'ONLINE' && (
          <div className="border-t border-border bg-bg/60 px-3 py-2 text-[10px] font-mono text-text-faint">
            Loading terminal status...
          </div>
        )}
      </div>
    </aside>
  )
}

function qualityForRow({
  apiStatus,
  last,
  age,
  subscribed,
}: {
  apiStatus: ApiStatus
  last: number | null
  age: number | null
  subscribed: boolean
}): DataQuality {
  if (apiStatus === 'OFFLINE') return 'BACKEND OFFLINE'
  if (apiStatus === 'WAKING' || apiStatus === 'UNKNOWN') return 'WARMING'
  if (!subscribed) return 'UNAVAILABLE'
  if (last == null || age == null) {
    return marketNoDataLabel()
  }
  const session = marketSessionLabel()
  if (session !== 'LIVE') return session
  if (age < 3000) return 'LIVE'
  if (age < 8000) return 'DELAYED'
  return 'STALE'
}

function normalizeWatchSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) return normalized
  return normalized.endsWith('-EQ') ? normalized : `${normalized}-EQ`
}

function compactSymbolName(symbol: string): string {
  return normalizeWatchSymbol(symbol).replace(/-EQ$/, '')
}

function formatLtp(value: number | null): string {
  return value != null
    ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}

function formatChange(value: number | null): string {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function marketSessionMeta(session: NseMarketSession): { label: string; dotClass: string } {
  if (session === 'OPEN') {
    return { label: 'NSE LIVE · 9:15–15:30 IST', dotClass: 'bg-up' }
  }
  if (session === 'PRE_MARKET') {
    return { label: 'NSE PRE-MARKET · Opens 9:15 IST', dotClass: 'bg-warn' }
  }
  if (session === 'WEEKEND') {
    return { label: 'NSE CLOSED · Weekend', dotClass: 'bg-text-faint' }
  }
  return { label: 'NSE CLOSED · Opens Mon 9:15 IST', dotClass: 'bg-text-faint' }
}
