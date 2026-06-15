'use client'

/**
 * WatchlistPanel — live NSE/BSE watchlist with user-customizable symbols.
 *
 * Architecture:
 *   • The "user's watchlist" is a list of NSE/BSE symbols persisted in
 *     localStorage (key: `tm:user_watchlist`). It's seeded on first load from
 *     the default indices (NIFTY/BANKNIFTY/MIDCPNIFTY/SENSEX + 7 majors).
 *   • On mount we hit /instruments (full universe, cached) to build a local
 *     lookup, /market-watch (live snapshot) to populate LTP, and /indices so
 *     the four protected indices have a guaranteed row even if the broker
 *     stream hasn't ticked yet.
 *   • Search is debounced (200ms) and queries /instruments/search so users
 *     can add any NSE/BSE symbol, not just the hardcoded seven.
 *   • Live ticks flow in through the existing useWebSocket → ingestTick path;
 *     we just read the live row from `marketWatch[sym]` in the store.
 *   • Add/remove go through /ws/subscribe (backend gateway) and through
 *     localStorage (UI persistence). The store is updated via existing
 *     `ingestMarketWatchRows` + `removeFromWatchlist` / `addToWatchlist`.
 */

import { Loader2, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import {
  fetchIndices,
  fetchMarketWatch,
  fetchProtectedSymbols,
  listInstruments,
  searchInstruments,
  setMarketWatch,
  wsSubscribeAdd,
  wsSubscribeRemove,
  type MarketWatchResponse,
} from '@/lib/api-client'
import type { Instrument, MarketWatchRow, IndexSnapshot } from '@/lib/types'
import { useTerminalStore } from '@/store/terminal-store'
import { useNow } from '@/hooks/useNow'
import { formatTickAge, isStale } from '@/lib/stale'
import { cn } from '@/lib/utils'

interface WatchlistPanelProps {
  className?: string
}

const LS_KEY = 'tm:user_watchlist'
// Mirror of backend defaults — NIFTY/BANKNIFTY/MIDCPNIFTY/SENSEX are
// protected on the backend and cannot be removed. The 7 majors mirror the
// prior hardcoded list so existing users don't lose context.
const DEFAULT_WATCHLIST: string[] = [
  'NIFTY',
  'BANKNIFTY',
  'MIDCPNIFTY',
  'SENSEX',
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
  'TATAMOTORS',
]

function loadStoredWatchlist(): string[] {
  if (typeof window === 'undefined') return DEFAULT_WATCHLIST
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_WATCHLIST
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string') && parsed.length > 0) {
      return parsed
    }
  } catch {
    // ignore corrupt localStorage
  }
  return DEFAULT_WATCHLIST
}

function persistWatchlist(symbols: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(symbols))
  } catch {
    // quota / private mode — non-fatal
  }
}

export function WatchlistPanel({ className }: WatchlistPanelProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Instrument[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [hydrationError, setHydrationError] = useState<string | null>(null)
  const [protectedSymbols, setProtectedSymbols] = useState<string[]>([
    'NIFTY',
    'BANKNIFTY',
    'MIDCPNIFTY',
    'SENSEX',
  ])
  const [indexSnapshots, setIndexSnapshots] = useState<IndexSnapshot[]>([])
  const [instrumentsBySymbol, setInstrumentsBySymbol] = useState<
    Record<string, Instrument>
  >({})

  // Persisted user watchlist (localStorage). Single source of truth for what
  // shows in the list. Backend's /ws/subscribe is updated in lockstep.
  const [userWatchlist, setUserWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)

  const activeSym = useTerminalStore((state) => state.activeSym)
  const setActiveSym = useTerminalStore((state) => state.setActiveSym)
  const marketWatchFromStore = useTerminalStore((state) => state.marketWatch)
  const lastTickBySymbol = useTerminalStore((state) => state.lastTickBySymbol)
  const ingestMarketWatchRows = useTerminalStore(
    (state) => state.ingestMarketWatchRows
  )
  const addToWatchlist = useTerminalStore((state) => state.addToWatchlist)
  const removeFromWatchlist = useTerminalStore(
    (state) => state.removeFromWatchlist
  )

  const now = useNow(2000) // Coarse interval: only need to update "age every 2s"

  const inputRef = useRef<HTMLInputElement | null>(null)

  // -- Hydration on mount ---------------------------------------------------

  // Load persisted watchlist from localStorage.
  useEffect(() => {
    setUserWatchlist(loadStoredWatchlist())
  }, [])

  // Fetch protected symbol list (so the UI can disable the remove button on
  // indices) and the live market-watch snapshot. Errors are non-fatal — the
  // user gets a non-blocking banner and the live WebSocket will overwrite
  // missing data as ticks flow in.
  const hydrate = useCallback(async () => {
    setHydrating(true)
    setHydrationError(null)
    try {
      const [protectedResp, mwResp, indicesResp, universeResp] =
        await Promise.allSettled([
          fetchProtectedSymbols(),
          fetchMarketWatch(),
          fetchIndices(),
          listInstruments({ pageSize: 200 }),
        ])

      if (protectedResp.status === 'fulfilled') {
        setProtectedSymbols(protectedResp.value.protected || [])
      }

      if (mwResp.status === 'fulfilled') {
        ingestMarketWatchRows(mwResp.value.items || [])
      }

      if (indicesResp.status === 'fulfilled') {
        setIndexSnapshots(indicesResp.value || [])
      }

      if (universeResp.status === 'fulfilled') {
        const map: Record<string, Instrument> = {}
        for (const instr of universeResp.value.instruments || []) {
          if (instr.symbol) map[instr.symbol] = instr
        }
        setInstrumentsBySymbol(map)
      }

      const failed = [protectedResp, mwResp, indicesResp, universeResp].filter(
        (r) => r.status === 'rejected'
      )
      if (failed.length === 4) {
        setHydrationError('Backend unavailable — using local fallback.')
      } else if (failed.length > 0) {
        setHydrationError(
          'Some watchlist data could not be loaded. Live ticks will still flow.'
        )
      }
    } catch (err) {
      setHydrationError(
        err instanceof Error
          ? `Hydration failed: ${err.message}`
          : 'Hydration failed — using local fallback.'
      )
    } finally {
      setHydrating(false)
    }
  }, [ingestMarketWatchRows])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // -- Debounced search -----------------------------------------------------

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      setSearching(false)
      setDebouncedQuery('')
      return
    }
    const t = setTimeout(() => setDebouncedQuery(trimmed), 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!debouncedQuery) return
    let cancelled = false
    setSearching(true)
    searchInstruments(debouncedQuery)
      .then((results) => {
        if (cancelled) return
        // Filter out anything already on the watchlist so the dropdown
        // only shows "addable" instruments.
        const onList = new Set(userWatchlist)
        setSearchResults(results.filter((r) => !onList.has(r.symbol)).slice(0, 12))
      })
      .catch(() => {
        if (cancelled) return
        setSearchResults([])
      })
      .finally(() => {
        if (cancelled) return
        setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, userWatchlist])

  // -- Add / remove ---------------------------------------------------------

  const pushWatchlistUpdate = useCallback(
    async (next: string[], addOps: string[], removeOps: string[]) => {
      setUserWatchlist(next)
      persistWatchlist(next)
      // Update the persistent backend watchlist (full replace).
      // /ws/subscribe is a separate, additive call so the gateway only
      // adjusts the live subscription diff.
      try {
        await setMarketWatch(next)
      } catch {
        // backend may be down — localStorage is the source of truth
      }
      if (addOps.length) {
        try {
          await wsSubscribeAdd(addOps)
        } catch {
          // non-fatal
        }
      }
      if (removeOps.length) {
        try {
          await wsSubscribeRemove(removeOps)
        } catch {
          // non-fatal
        }
      }
    },
    []
  )

  const handleAdd = useCallback(
    async (sym: string) => {
      const normalized = sym.trim().toUpperCase()
      if (!normalized) return
      if (userWatchlist.includes(normalized)) {
        setQuery('')
        setSearchOpen(false)
        return
      }
      addToWatchlist(normalized) // local store group
      const next = [...userWatchlist, normalized]
      await pushWatchlistUpdate(next, [normalized], [])
      setQuery('')
      setSearchOpen(false)
      inputRef.current?.blur()
    },
    [addToWatchlist, pushWatchlistUpdate, userWatchlist]
  )

  const handleRemove = useCallback(
    async (sym: string) => {
      if (protectedSymbols.includes(sym)) return // never remove indices
      removeFromWatchlist(sym)
      const next = userWatchlist.filter((s) => s !== sym)
      await pushWatchlistUpdate(next, [], [sym])
    },
    [protectedSymbols, pushWatchlistUpdate, removeFromWatchlist, userWatchlist]
  )

  // -- Derive rows ----------------------------------------------------------

  // We render the four protected indices FIRST (even if user has not added
  // them) so they are always visible. Then the rest of the user's list.
  const rows = useMemo(() => {
    const ordered: string[] = []
    for (const p of protectedSymbols) {
      if (!ordered.includes(p)) ordered.push(p)
    }
    for (const s of userWatchlist) {
      if (!ordered.includes(s)) ordered.push(s)
    }
    return ordered
  }, [protectedSymbols, userWatchlist])

  // Local filter for the dropdown chip "no results match query" — also
  // shows the user when their local list is empty.
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((sym) => {
      const meta = instrumentsBySymbol[sym]
      return (
        sym.toLowerCase().includes(q) ||
        (meta?.name?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [instrumentsBySymbol, query, rows])

  // Merge: prefer live row from store → fallback to index snapshot → fallback
  // to instruments metadata (name/exchange only, no LTP).
  const renderRow = (sym: string) => {
    const live: MarketWatchRow | undefined = marketWatchFromStore[sym]
    const idx: IndexSnapshot | undefined = indexSnapshots.find(
      (i) => i.symbol === sym
    )
    const instr: Instrument | undefined = instrumentsBySymbol[sym]
    const ltp = live?.ltp ?? idx?.ltp ?? null
    const previous = live?.previous_ltp ?? null
    const change = live?.change ?? idx?.change ?? null
    const changePct = live?.change_pct ?? idx?.change_pct ?? null
    const name =
      live?.name ??
      idx?.name ??
      instr?.name ??
      (DEMO_SYMBOLS.find((d) => d.sym === sym)?.name ?? null)
    const isProtected = protectedSymbols.includes(sym)
    const lastTickAt = lastTickBySymbol[sym] ?? null
    return { sym, ltp, previous, change, changePct, name, isProtected, lastTickAt }
  }

  return (
    <aside
      className={cn(
        'flex min-h-0 w-[240px] shrink-0 flex-col overflow-hidden border-r border-border bg-panel',
        className
      )}
    >
      <div className="relative border-b border-border p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              // delay so click on dropdown can register
              setTimeout(() => setSearchOpen(false), 150)
            }}
            placeholder="Add NSE / BSE symbol…"
            className="h-8 w-full rounded border border-border bg-surface pl-7 pr-7 font-mono text-[10px] text-text-primary outline-none placeholder:text-text-hint focus:border-accent"
            aria-label="Search and add symbol"
            data-testid="watchlist-search"
          />
          {hydrating ? (
            <Loader2
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-hint"
              aria-hidden="true"
            />
          ) : query ? (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => {
                e.preventDefault()
                setQuery('')
                setSearchResults([])
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-text-hint hover:bg-hover hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </label>

        {searchOpen && debouncedQuery.length >= 2 ? (
          <div
            className="absolute left-3 right-3 top-[44px] z-30 max-h-[280px] overflow-y-auto rounded border border-border bg-elevated shadow-[0_8px_24px_rgba(0,0,0,.55)]"
            role="listbox"
            aria-label="Search results"
          >
            {searching ? (
              <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching…
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-text-hint">
                No match in instrument master.
              </div>
            ) : (
              searchResults.map((result) => (
                <button
                  key={result.symbol}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void handleAdd(result.symbol)
                  }}
                  className="flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-left text-[10px] hover:bg-hover"
                  data-testid={`watchlist-search-result-${result.symbol}`}
                >
                  <span className="min-w-0">
                    <span className="block font-mono font-semibold text-text-primary">
                      {result.symbol}
                    </span>
                    <span className="block truncate text-text-muted">
                      {result.name}
                      {result.exchange ? ` · ${result.exchange}` : ''}
                    </span>
                  </span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-accent" />
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        <span>Watchlist</span>
        <span className="font-mono text-text-hint">
          {rows.length} {rows.length === 1 ? 'symbol' : 'symbols'}
        </span>
      </div>

      {hydrationError ? (
        <div
          className="border-b border-border/60 bg-elevated/60 px-3 py-1.5 text-[10px] text-warn"
          role="status"
        >
          {hydrationError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredRows.length === 0 ? (
          <div className="px-3 py-4 text-center text-[10px] text-text-hint">
            {hydrating
              ? 'Loading watchlist…'
              : query
                ? 'No symbols match this search.'
                : 'Type to add a symbol.'}
          </div>
        ) : (
          filteredRows.map((sym) => {
            const r = renderRow(sym)
            const active = activeSym === r.sym
            const ltp = r.ltp
            const changePct = r.changePct
            const positive = (changePct ?? 0) >= 0 && ltp != null
            const rowStale = isStale(r.lastTickAt, now, 10_000)
            const rowAge = formatTickAge(r.lastTickAt, now)
            return (
              <div
                key={r.sym}
                className={cn(
                  'group flex items-stretch border-b border-border transition-colors hover:bg-hover',
                  active && 'border-l-2 border-l-accent bg-surface pl-[10px]',
                  rowStale && 'opacity-60'
                )}
                data-active={active}
                data-testid={`watchlist-row-${r.sym}`}
              >
                <button
                  type="button"
                  onClick={() => setActiveSym(r.sym)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="grid grid-cols-[minmax(0,1fr)_60px_74px] items-center gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1">
                        <span className="block truncate text-xs font-semibold text-text-primary">
                          {r.sym}
                        </span>
                        {r.isProtected ? (
                          <span className="rounded-sm border border-border px-1 font-mono text-[8px] uppercase tracking-[0.08em] text-text-hint">
                            idx
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[10px] text-text-muted">
                        {r.name ?? '—'}
                      </span>
                    </span>
                    <MiniSparkline symbol={r.sym} positive={positive} />
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-xs text-text-primary">
                        {ltp == null
                          ? '—'
                          : formatINR(ltp)}
                      </span>
                      <span
                        className={cn(
                          'block font-mono text-[10px]',
                          ltp == null
                            ? 'text-text-hint'
                            : positive
                              ? 'text-up'
                              : 'text-dn'
                        )}
                      >
                        {changePct == null
                          ? '—'
                          : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
                      </span>
                      {rowAge ? (
                        <span
                          className={cn(
                            'block font-mono text-[9px]',
                            rowStale ? 'text-warn' : 'text-text-hint'
                          )}
                          aria-label={
                            rowStale
                              ? `${r.sym} price data is stale. Last tick ${rowAge}.`
                              : `${r.sym} last tick ${rowAge}`
                          }
                        >
                          {rowStale ? `stale · ${rowAge}` : rowAge}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
                {r.isProtected ? (
                  <span
                    className="flex w-7 items-center justify-center text-text-hint"
                    aria-label="Protected index — cannot be removed"
                    title="Protected index"
                  >
                    <span className="font-mono text-[9px] uppercase tracking-[0.06em]">
                      IDX
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleRemove(r.sym)}
                    className="flex w-7 items-center justify-center text-text-hint opacity-0 transition-opacity hover:text-dn group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Remove ${r.sym} from watchlist`}
                    data-testid={`watchlist-remove-${r.sym}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

function MiniSparkline({ symbol, positive }: { symbol: string; positive: boolean }) {
  const values = useMemo(() => {
    const seed = Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return Array.from({ length: 8 }, (_, index) => {
      const drift = Math.sin((seed + index * 17) / 11) * 7
      const trend = positive ? index * 1.4 : (7 - index) * 1.4
      return 16 - trend + drift
    })
  }, [positive, symbol])

  const points = values
    .map((value, index) => {
      const x = 4 + index * 7
      const y = Math.round(Math.min(18, Math.max(3, value)) * 1000) / 1000
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="60" height="20" viewBox="0 0 60 20" className="shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? 'var(--color-up)' : 'var(--color-dn)'}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
}

// Re-export so the parent layout (which imports this) doesn't change.
export type { MarketWatchResponse }
