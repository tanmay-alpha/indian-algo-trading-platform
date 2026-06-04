'use client'

import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn, fmtVolume } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'
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
  const [groupOpen, setGroupOpen] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)

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
  return (
    <aside
      aria-label="Watchlist"
      className={cn("w-watchlist shrink-0 h-full bg-bg-2/80 backdrop-blur-md border-r border-[#38bdf8]/10 flex flex-col glass-panel", className)}
    >
      <div className="px-3 py-2 border-b border-border bg-panel/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text uppercase tracking-wider">Market Watch</span>
            {watchlistSource === 'db' ? (
              <span className="text-xs text-up font-mono">●</span>
            ) : (
              <span className="text-xs text-warn font-mono animate-pulse">●</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-faint">
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
              className="h-7 px-2 flex items-center gap-1 rounded-sm border border-border bg-bg text-xs font-mono text-text-2 hover:text-text transition-colors"
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
                      'w-full px-2.5 h-7 flex items-center justify-between text-xs font-mono hover:bg-white/[0.04]',
                      group.id === groupId ? 'text-info bg-info/5' : 'text-text-dim'
                    )}
                  >
                    <span className="truncate">{group.name}</span>
                    <span className="text-xs opacity-40">{group.symbols.length}</span>
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
        <div className="mx-3 mt-2 rounded border border-warn/25 bg-warn/5 px-2 py-1 text-xs text-warn leading-tight">
          Admin token required to write to DB. Changes are local-only.
        </div>
      )}
      {watchlistError && !watchlistAdminRequired && (
        <div className="mx-3 mt-2 rounded border border-warn/25 bg-warn/5 px-2 py-1 text-xs text-warn leading-tight">
          {watchlistError}
        </div>
      )}

      <div className="grid h-5 grid-cols-[minmax(0,1fr)_68px_48px_36px] items-center gap-2 border-b border-border bg-panel/50 px-2 mt-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)]">
        <span>INSTRUMENT</span>
        <span className="text-right">LTP</span>
        <span className="text-right">CHG%</span>
        <span className="text-right">VOL</span>
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
            const subscribed =
              subscribedSymbols.size === 0 || subscribedSymbols.has(normalizeWatchSymbol(symbol))
            const isSelected = selected === symbol
            const ltp = row?.ltp ?? null
            const chgPct = row?.change_pct ?? null
            const volume = row?.volume ?? null
            const displayLtp = subscribed ? ltp : null
            const displayChgPct = subscribed ? chgPct : null
            const displayVolume = subscribed ? volume : null
            const displayName = row?.name ?? compactSymbolName(symbol)
            const cleanSymbol = compactSymbolName(symbol)
            const hasLiveTick = subscribed && last != null
            const lastMove =
              row?.previous_ltp != null && displayLtp != null
                ? displayLtp - row.previous_ltp
                : displayChgPct
            const flashClass =
              row?.previous_ltp != null && displayLtp != null && displayLtp !== row.previous_ltp
                ? displayLtp > row.previous_ltp
                  ? 'flash-up'
                  : 'flash-down'
                : undefined

            return (
              <div
                key={symbol}
                onClick={() => setSelected(symbol)}
                className={cn(
                  'wl-row group relative grid h-8 cursor-pointer select-none grid-cols-[minmax(0,1fr)_68px_48px_36px] items-center gap-2 border-b border-border/50 px-2',
                  isSelected && 'selected border-l-2 border-l-[var(--neutral)] bg-[var(--neutral-dim)]',
                  flashClass
                )}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      hasLiveTick
                        ? 'bg-up animate-pulse-soft'
                        : subscribed
                        ? 'bg-warn'
                        : 'bg-text-faint'
                    )}
                  />
                  <span className="shrink-0 font-mono text-[11px] font-semibold leading-none text-[var(--text-1)]">
                    {cleanSymbol}
                  </span>
                  <span className="max-w-[120px] min-w-0 truncate text-[10px] leading-none text-[var(--text-3)]">
                    {displayName}
                  </span>
                  {!subscribed && (
                    <span className="shrink-0 rounded-sm border border-border px-1 font-mono text-[9px] font-semibold leading-4 text-[var(--text-3)]">
                      NO FEED
                    </span>
                  )}
                </div>

                <span className={cn(
                  'w-[68px] text-right font-mono text-[13px] font-semibold leading-none tabular-nums',
                  displayLtp == null
                    ? 'text-[var(--text-3)]'
                    : lastMove != null && lastMove < 0
                    ? 'price-down'
                    : lastMove != null && lastMove > 0
                    ? 'price-up'
                    : 'text-[var(--text-1)]'
                )}>
                  {displayLtp != null ? formatLtp(displayLtp) : '—'}
                </span>
                <span className={cn(
                  'w-[48px] text-right font-mono text-[10px] leading-none tabular-nums',
                  displayChgPct == null
                    ? 'text-[var(--text-3)]'
                    : displayChgPct < 0
                    ? 'price-down'
                    : 'price-up'
                )}>
                  {displayChgPct != null ? formatChange(displayChgPct) : '—'}
                </span>
                <span className="w-[36px] text-right font-mono text-[10px] leading-none tabular-nums text-[var(--text-3)]">
                  {displayLtp != null && displayVolume != null ? fmtVolume(displayVolume) : '—'}
                </span>

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
          <div className="border-t border-border bg-bg/60 px-3 py-2 text-xs font-mono text-text-faint">
            Loading terminal status...
          </div>
        )}
      </div>
    </aside>
  )
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
    : '-'
}

function formatChange(value: number | null): string {
  if (value == null) return '-'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}
