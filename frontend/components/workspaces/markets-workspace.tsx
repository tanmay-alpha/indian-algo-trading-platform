'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import {
  getDiscoveryBoard,
  getDiscoveryStatus,
  getGainers,
  getInstrumentsPaginated,
  getLosers,
  getMostActive,
  getSectorInstruments,
  getSectors,
  runScreener,
} from '@/lib/api'
import type {
  DiscoveryBoard,
  DiscoveryStatus,
  Instrument,
  MarketMover,
  PaginatedInstruments,
  ScreenerFilters,
  ScreenerResult,
  Timeframe,
} from '@/lib/types'
import { cn, fmtPct, fmtPrice, fmtVolume, marketSessionLabel } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'

type MarketsTab = 'all' | 'gainers' | 'losers' | 'active' | 'screener'

const TABS: Array<{ id: MarketsTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
  { id: 'active', label: 'Most Active' },
  { id: 'screener', label: 'Screener' },
]

const SCREENER_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '1d']

export function MarketsWorkspace() {
  const [tab, setTab] = useState<MarketsTab>('all')
  const [sectors, setSectors] = useState<string[]>([])
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [instruments, setInstruments] = useState<PaginatedInstruments>({
    instruments: [],
    page: 1,
    page_size: 50,
    total: 0,
    total_pages: 1,
  })
  const [query, setQuery] = useState('')
  const [movers, setMovers] = useState<MarketMover[]>([])
  const [board, setBoard] = useState<DiscoveryBoard | null>(null)
  const [status, setStatus] = useState<DiscoveryStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [screener, setScreener] = useState<ScreenerResult | null>(null)
  const [filters, setFilters] = useState<Record<string, string | boolean>>({
    price_above_vwap: false,
  })
  const [screenerTimeframe, setScreenerTimeframe] = useState<Timeframe>('5m')
  const [screenerLimit, setScreenerLimit] = useState(20)

  const marketWatch = useTerminalStore((s) => s.marketWatch)
  const indices = useTerminalStore((s) => s.indices)
  const setSelectedSymbol = useTerminalStore((s) => s.setSelectedSymbol)
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)

  useEffect(() => {
    let cancelled = false
    async function loadShellData() {
      const [sectorList, boardData, statusData] = await Promise.all([
        getSectors(),
        getDiscoveryBoard(),
        getDiscoveryStatus(),
      ])
      if (cancelled) return
      setSectors(sectorList)
      setBoard(boardData)
      setStatus(statusData)
    }
    void loadShellData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (tab !== 'all') return
    let cancelled = false
    async function loadInstruments() {
      setLoading(true)
      setError(null)
      const data = selectedSector && !query.trim()
        ? await sectorResult(selectedSector)
        : await getInstrumentsPaginated(1, 50, query)
      if (cancelled) return
      setInstruments(data)
      setLoading(false)
    }
    void loadInstruments()
    return () => {
      cancelled = true
    }
  }, [query, selectedSector, tab])

  useEffect(() => {
    if (!['gainers', 'losers', 'active'].includes(tab)) return
    let cancelled = false
    async function loadMovers() {
      const data = await loadMoverTab(tab)
      if (!cancelled) setMovers(data)
    }
    void loadMovers()
    const id = window.setInterval(() => void loadMovers(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tab])

  const visibleInstruments = useMemo(() => {
    return instruments.instruments.map((instrument) => ({
      ...instrument,
      ltp: marketWatch[instrument.symbol]?.ltp ?? marketWatch[instrument.clean_symbol || '']?.ltp ?? null,
    }))
  }, [instruments.instruments, marketWatch])

  const onInstrumentClick = (symbol: string) => {
    setSelectedSymbol(symbol)
    setWorkspace('charts')
  }

  const onRunScreener = async () => {
    setLoading(true)
    setError(null)
    const parsed = parseFilters(filters)
    const result = await runScreener(parsed, screenerTimeframe, screenerLimit)
    setScreener(result)
    setLoading(false)
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)_220px] gap-3 overflow-hidden p-3">
      <aside className="min-h-0 overflow-hidden rounded-sm border border-border bg-panel/60">
        <PanelHeader title="Sectors" subtitle={`${sectors.length} available`} />
        <div className="h-[calc(100%-42px)] overflow-auto p-2">
          {sectors.length === 0 ? (
            <EmptyBlock title="No sectors loaded" hint="Instrument master may still be fallback-only." />
          ) : (
            sectors.map((sector) => (
              <button
                key={sector}
                onClick={() => {
                  setSelectedSector(sector)
                  setQuery('')
                  setTab('all')
                }}
                className={cn(
                  'mb-1 flex h-8 w-full items-center justify-between rounded-sm border px-2 text-left font-mono text-[10px]',
                  selectedSector === sector
                    ? 'border-info/40 bg-info-dim text-info'
                    : 'border-border bg-bg text-text-dim hover:text-text'
                )}
              >
                <span className="truncate">{sector}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-hidden rounded-sm border border-border bg-panel/60">
        <div className="flex h-10 items-center justify-between border-b border-border bg-bg/70 px-3">
          <div className="flex items-center gap-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'h-7 rounded-sm border px-2 text-[10px] font-mono',
                  tab === item.id
                    ? 'border-info/40 bg-info-dim text-info'
                    : 'border-border bg-panel text-text-dim hover:text-text'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'all' && (
            <label className="flex h-7 w-[260px] items-center gap-2 rounded-sm border border-border bg-bg px-2">
              <Search className="h-3.5 w-3.5 text-text-faint" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedSector(null)
                }}
                placeholder="Search NSE instruments"
                className="w-full bg-transparent font-mono text-[10px] text-text outline-none placeholder:text-text-faint"
              />
            </label>
          )}
        </div>

        <div className="h-[calc(100%-40px)] overflow-auto">
          {tab === 'all' && (
            <InstrumentTable
              instruments={visibleInstruments}
              loading={loading}
              error={error}
              onClick={onInstrumentClick}
            />
          )}
          {tab === 'gainers' && <MoverTable rows={movers} mode="gainers" />}
          {tab === 'losers' && <MoverTable rows={movers} mode="losers" />}
          {tab === 'active' && <MoverTable rows={movers} mode="active" />}
          {tab === 'screener' && (
            <ScreenerPanel
              filters={filters}
              setFilters={setFilters}
              timeframe={screenerTimeframe}
              setTimeframe={setScreenerTimeframe}
              limit={screenerLimit}
              setLimit={setScreenerLimit}
              loading={loading}
              result={screener}
              onRun={onRunScreener}
            />
          )}
        </div>
      </main>

      <aside className="min-h-0 space-y-3 overflow-auto">
        <section className="rounded-sm border border-border bg-panel/60">
          <PanelHeader title="Market Board" subtitle={status?.instrument_master_source || 'fallback'} />
          <div className="grid gap-2 p-3">
            <SummaryRow label="Tracked" value={String(board?.summary.total_symbols_tracked ?? 0)} />
            <SummaryRow label="With Data" value={String(board?.summary.symbols_with_data ?? 0)} />
            <SummaryRow label="Stale" value={String(board?.summary.symbols_stale ?? 0)} />
            <div className="mt-1 text-[9px] leading-4 text-text-faint">
              {board?.note || 'Data reflects only subscribed symbols.'}
            </div>
          </div>
        </section>

        <section className="rounded-sm border border-border bg-panel/60">
          <PanelHeader title="Index Strip" subtitle="Feed dependent" />
          <div className="p-2 space-y-1">
            {['NIFTY 50', 'NIFTY BANK'].map((label) => {
              const index = indices.find((item) => item.name === label || item.symbol === label.replace(' ', ''))
              const noDataLabel = marketSessionLabel() === 'LIVE' ? 'WAITING' : marketSessionLabel()
              return (
                <div key={label} className="rounded-sm border border-border bg-bg px-2 py-1.5 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text">{label}</span>
                    <span className="text-text-dim">{fmtPrice(index?.ltp)}</span>
                  </div>
                  <div className="mt-0.5 text-text-faint">{index?.ltp == null ? noDataLabel : fmtPct(index.change_pct)}</div>
                </div>
              )
            })}
          </div>
        </section>
      </aside>
    </div>
  )
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-border bg-bg/70 px-3 py-2">
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="text-[9px] font-mono text-text-faint">{subtitle}</div>
    </div>
  )
}

function InstrumentTable({
  instruments,
  loading,
  error,
  onClick,
}: {
  instruments: Array<Instrument & { ltp?: number | null }>
  loading: boolean
  error: string | null
  onClick: (symbol: string) => void
}) {
  if (loading) return <SkeletonRows />
  if (error) return <EmptyBlock title="Discovery unavailable" hint={error} />
  if (instruments.length === 0) {
    return <EmptyBlock title="No instruments" hint="Search or select a sector after the instrument master loads." />
  }
  return (
    <div>
      <Header columns={['Symbol', 'Name', 'Sector', 'LTP']} />
      {instruments.map((instrument) => (
        <button
          key={`${instrument.symbol}-${instrument.token}`}
          onClick={() => onClick(instrument.symbol)}
          className="grid w-full grid-cols-[130px_1fr_160px_100px] gap-2 border-b border-border/60 px-3 py-2 text-left font-mono text-[10px] hover:bg-bg"
        >
          <span className="text-text">{instrument.symbol}</span>
          <span className="truncate text-text-dim">{instrument.name}</span>
          <span className="truncate text-text-faint">{instrument.sector || '\u2014'}</span>
          <span className="text-right text-text">{fmtPrice(instrument.ltp)}</span>
        </button>
      ))}
    </div>
  )
}

function MoverTable({ rows, mode }: { rows: MarketMover[]; mode: 'gainers' | 'losers' | 'active' }) {
  if (rows.length === 0) {
    return <EmptyBlock title="No data" hint="Only subscribed symbols are available for movers. No fake prices are shown." />
  }
  const columns = mode === 'active' ? ['Rank', 'Symbol', 'LTP', 'Volume'] : ['Rank', 'Symbol', 'LTP', 'Change%']
  return (
    <div>
      <Header columns={columns} />
      {rows.map((row, index) => (
        <div key={`${row.symbol}-${index}`} className="grid grid-cols-4 gap-2 border-b border-border/60 px-3 py-2 font-mono text-[10px]">
          <span className="text-text-faint">{index + 1}</span>
          <span className="text-text">{row.symbol}</span>
          <span className="text-text">{fmtPrice(row.ltp)}</span>
          <span className={mode === 'active' ? 'text-text-dim' : row.change_pct != null && row.change_pct >= 0 ? 'text-up' : 'text-down'}>
            {mode === 'active' ? fmtVolume(row.volume) : fmtPct(row.change_pct)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ScreenerPanel({
  filters,
  setFilters,
  timeframe,
  setTimeframe,
  limit,
  setLimit,
  loading,
  result,
  onRun,
}: {
  filters: Record<string, string | boolean>
  setFilters: (filters: Record<string, string | boolean>) => void
  timeframe: Timeframe
  setTimeframe: (timeframe: Timeframe) => void
  limit: number
  setLimit: (limit: number) => void
  loading: boolean
  result: ScreenerResult | null
  onRun: () => void
}) {
  const update = (key: string, value: string | boolean) => setFilters({ ...filters, [key]: value })
  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-5 gap-2 rounded-sm border border-border bg-bg/60 p-3">
        <Input label="RSI below" value={String(filters.rsi_below || '')} onChange={(v) => update('rsi_below', v)} />
        <Input label="RSI above" value={String(filters.rsi_above || '')} onChange={(v) => update('rsi_above', v)} />
        <Input label="Price above EMA" value={String(filters.price_above_ema || '')} onChange={(v) => update('price_above_ema', v)} />
        <Input label="Change % above" value={String(filters.change_pct_above || '')} onChange={(v) => update('change_pct_above', v)} />
        <label className="flex items-end gap-2 pb-1 font-mono text-[10px] text-text-dim">
          <input
            type="checkbox"
            checked={Boolean(filters.price_above_vwap)}
            onChange={(event) => update('price_above_vwap', event.target.checked)}
          />
          Price above VWAP
        </label>
        <select value={timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)} className="h-8 rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text">
          {SCREENER_TIMEFRAMES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="h-8 rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text">
          {[10, 20, 50].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button onClick={onRun} disabled={loading} className="h-8 rounded-sm border border-info/40 bg-info-dim px-3 font-mono text-[10px] text-info disabled:opacity-50">
          {loading ? 'Running' : 'Run Screener'}
        </button>
      </div>

      <div className="text-[10px] font-mono text-text-faint">
        Screener runs on currently loaded candle data only. Symbols must be in your watchlist to have indicator data.
      </div>

      {!result ? (
        <EmptyBlock title="No screener run" hint="Set filters and run the screener against cached candle data." />
      ) : result.results.length === 0 ? (
        <EmptyBlock title="No matches" hint={result.note} />
      ) : (
        <div>
          <Header columns={['Symbol', 'LTP', 'Change%', 'RSI', 'EMA', 'VWAP', 'Live']} />
          {result.results.map((row) => (
            <div key={row.symbol} className="grid grid-cols-7 gap-2 border-b border-border/60 px-3 py-2 font-mono text-[10px]">
              <span className="text-text">{row.symbol}</span>
              <span>{fmtPrice(row.ltp)}</span>
              <span>{fmtPct(row.change_pct)}</span>
              <span>{fmtPrice(row.indicators.rsi)}</span>
              <span>{fmtPrice(row.indicators.ema_20)}</span>
              <span>{fmtPrice(row.indicators.vwap)}</span>
              <span className={row.is_live ? 'text-up' : 'text-text-faint'}>{row.is_live ? 'LIVE' : '\u2014'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Header({ columns }: { columns: string[] }) {
  return (
    <div
      className="grid gap-2 border-b border-border bg-bg px-3 py-1.5 font-mono text-[9px] uppercase text-text-faint"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map((column) => <span key={column}>{column}</span>)}
    </div>
  )
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-mono uppercase text-text-faint">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text outline-none focus:border-info/50"
      />
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border bg-bg px-2 py-1.5 font-mono text-[10px]">
      <span className="text-text-faint">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  )
}

function EmptyBlock({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid min-h-[180px] place-items-center p-6 text-center">
      <div>
        <div className="text-xs font-semibold text-text">{title}</div>
        <div className="mt-1 max-w-md text-[10px] font-mono text-text-faint">{hint}</div>
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-8 animate-pulse rounded-sm border border-border bg-bg" />
      ))}
    </div>
  )
}

async function loadMoverTab(tab: MarketsTab): Promise<MarketMover[]> {
  if (tab === 'gainers') return getGainers(20)
  if (tab === 'losers') return getLosers(20)
  if (tab === 'active') return getMostActive(20)
  return []
}

async function sectorResult(sector: string): Promise<PaginatedInstruments> {
  const instruments = await getSectorInstruments(sector)
  return {
    instruments,
    page: 1,
    page_size: 50,
    total: instruments.length,
    total_pages: 1,
  }
}

function parseFilters(filters: Record<string, string | boolean>): ScreenerFilters {
  const parsed: ScreenerFilters = {}
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'boolean') {
      if (value) parsed[key as keyof ScreenerFilters] = value as never
      continue
    }
    if (value === '') continue
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) {
      parsed[key as keyof ScreenerFilters] = numberValue as never
    }
  }
  return parsed
}
