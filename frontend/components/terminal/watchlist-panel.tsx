'use client'

import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ApiStatus, DataQuality, NseMarketSession } from '@/lib/types'
import { cn, fmtAge, fmtVolume, getNseMarketSession, marketNoDataLabel, marketSessionLabel } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'
import { useNow } from '@/lib/use-now'
import { EmptyState } from './empty-state'
import { InstrumentSearch } from './instrument-search'
import { SafetyBadgeGroup } from './safety-badge'

export function WatchlistPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const groups = useTerminalStore((s) => s.watchlistGroups)
  const groupId = useTerminalStore((s) => s.watchlistGroupId)
  const setGroup = useTerminalStore((s) => s.setWatchlistGroup)
  const market = useTerminalStore((s) => s.marketWatch)
  const lastBy = useTerminalStore((s) => s.lastTickBySymbol)
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const setSelected = useTerminalStore((s) => s.setSelectedSymbol)
  
  // Use persistent store actions
  const addSymbolToBackend = useTerminalStore((s) => s.addSymbolToBackend)
  const removeSymbolFromBackend = useTerminalStore((s) => s.removeSymbolFromBackend)
  const fetchPersistentWatchlist = useTerminalStore((s) => s.fetchPersistentWatchlist)
  const watchlistSource = useTerminalStore((s) => s.watchlistSource)
  const watchlistError = useTerminalStore((s) => s.watchlistError)
  const watchlistAdminRequired = useTerminalStore((s) => s.watchlistAdminRequired)
  const watchlistLoading = useTerminalStore((s) => s.watchlistLoading)

  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const terminalStatus = useTerminalStore((s) => s.terminalStatus)
  const now = useNow()

  const [groupOpen, setGroupOpen] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    fetchPersistentWatchlist()
  }, [fetchPersistentWatchlist])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) {
        setGroupOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const activeGroup = groups.find((group) => group.id === groupId) ?? groups[0]
  const symbols = activeGroup ? activeGroup.symbols : []
  const subscribedSymbols = new Set(
    Array.isArray(terminalStatus?.gateway?.subscribed_symbols)
      ? terminalStatus.gateway.subscribed_symbols.map((item) => normalizeWatchSymbol(String(item)))
      : []
  )
  const session = mounted ? getNseMarketSession() : 'CLOSED'
  const sessionMeta = marketSessionMeta(session)

  return (
    <aside
      aria-label="Watchlist"
      className={cn("w-watchlist shrink-0 h-full bg-bg-2/80 backdrop-blur-md border-r border-[#38bdf8]/10 flex flex-col glass-panel", className)}
    >
      <div className="px-3 py-2 border-b border-border bg-panel/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text uppercase tracking-wider">Market Watch</span>
            {watchlistSource === 'db' ? (
              <span className="text-[10px] text-up font-mono">●</span>
            ) : (
              <span className="text-[10px] text-warn font-mono animate-pulse">●</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-faint">
              {watchlistLoading ? '...' : `${symbols.length} items`}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/5 text-text-faint hover:text-text transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-start gap-1 overflow-x-auto scrollbar-none select-none">
          <SafetyBadgeGroup size="xs" className="flex-nowrap" />
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <div ref={groupRef} className="relative">
            <button
              onClick={() => setGroupOpen((open) => !open)}
              className="h-7 px-2 flex items-center gap-1 rounded-sm border border-border bg-bg text-[10px] font-mono text-text-2 hover:text-text transition-colors"
            >
              <span className="max-w-[60px] truncate">{activeGroup?.name ?? '\u2014'}</span>
              <ChevronDown className="w-2.5 h-3 text-text-faint" />
            </button>
            {groupOpen && (
              <div className="absolute z-20 left-0 mt-1 w-40 bg-panel-2 border border-border-strong rounded-sm shadow-modal py-1">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setGroup(group.id)
                      setGroupOpen(false)
                    }}
                    className={cn(
                      'w-full px-2.5 h-7 flex items-center justify-between text-[11px] font-mono hover:bg-white/[0.04]',
                      group.id === groupId ? 'text-info bg-info/5' : 'text-text-dim'
                    )}
                  >
                    <span className="truncate">{group.name}</span>
                    <span className="text-[10px] opacity-40">{group.symbols.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <InstrumentSearch
            onPick={(instrument) => addSymbolToBackend(instrument.symbol)}
            placeholder="Find instrument..."
            className="flex-1"
          />
        </div>
      </div>

      {watchlistAdminRequired && (
        <div className="mx-3 mt-2 rounded border border-warn/25 bg-warn/5 px-2 py-1 text-[10px] text-warn leading-tight">
          Admin token required to write to DB. Changes are local-only.
        </div>
      )}
      {watchlistError && !watchlistAdminRequired && (
        <div className="mx-3 mt-2 rounded border border-warn/25 bg-warn/5 px-2 py-1 text-[10px] text-warn leading-tight">
          {watchlistError}
        </div>
      )}

      <div className="flex h-7 items-center border-b border-border bg-panel/50 px-2 mt-1">
        <div className="flex-1 font-mono text-[10px] uppercase tracking-widest text-text-faint">INSTRUMENT</div>
        <div className="w-[68px] text-right font-mono text-[10px] tracking-wide text-text-faint">LTP</div>
        <div className="w-[48px] text-right font-mono text-[10px] tracking-wide text-text-faint">CHG%</div>
        <div className="w-[36px] text-right font-mono text-[10px] tracking-wide text-text-faint">VOL</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {symbols.length === 0 ? (
          <EmptyState
            title="Watchlist empty"
            hint={watchlistSource === 'fallback' || watchlistSource === null || watchlistAdminRequired
              ? 'Watchlist API not connected. Search NSE instruments to build a local watchlist.'
              : 'Search NSE instruments to add symbols. Live ticks require market feed.'}
            icon={<Search className="w-6 h-6" />}
            compact
          />
        ) : (
          symbols.map((symbol) => {
            const row = market[symbol]
            const last = lastBy[symbol] ?? null
            const age = last ? now - last : null
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
              : (mounted && marketSessionLabel() === 'LIVE')
              ? 'Awaiting tick'
              : 'Market closed'

            return (
              <div
                key={symbol}
                onClick={() => setSelected(symbol)}
                className={cn(
                  'wl-row group relative flex h-[36px] cursor-pointer select-none items-center border-b border-border/50 px-2',
                  isSelected && 'selected bg-info/[0.04]'
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

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className="shrink-0 font-mono text-[12px] font-semibold tracking-wide text-text leading-tight">
                    {cleanSymbol}
                  </span>
                  <span className="min-w-0 truncate text-[10px] text-text-faint leading-tight">
                    {displayName || meta}
                  </span>
                </div>

                <div className="ml-1 flex shrink-0 items-center gap-2">
                  <span className={cn(
                    'w-[68px] text-right font-mono text-[12px] font-semibold tabular-nums',
                    displayLtp == null
                      ? 'text-text-faint/70 text-[10px]'
                      : displayChgPct != null && displayChgPct > 0
                      ? 'text-up'
                      : displayChgPct != null && displayChgPct < 0
                      ? 'text-down'
                      : 'text-text-2'
                  )}>
                    {displayLtp != null ? formatLtp(displayLtp) : 'No tick'}
                  </span>
                  <span className={cn(
                    'w-[48px] text-right font-mono text-[10px] tabular-nums',
                    displayLtp == null
                      ? 'text-text-faint/45'
                      : displayChgPct != null && displayChgPct > 0
                      ? 'text-up'
                      : displayChgPct != null && displayChgPct < 0
                      ? 'text-down'
                      : 'text-text-faint'
                  )}>
                    {displayLtp != null ? formatChange(displayChgPct) : '—'}
                  </span>
                  <span className={cn(
                    'w-[36px] text-right font-mono text-[10px] tabular-nums',
                    displayLtp == null
                      ? 'text-text-faint/45'
                      : 'text-text-faint'
                  )}>
                    {displayLtp != null && displayVolume != null ? fmtVolume(displayVolume) : '—'}
                  </span>
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    removeSymbolFromBackend(symbol)
                  }}
                  aria-label={`Remove ${symbol}`}
                  className="absolute right-1 top-0.5 opacity-0 group-hover:opacity-100 rounded p-0.5 text-text-dim hover:text-down hover:bg-down-dim transition-opacity"
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
