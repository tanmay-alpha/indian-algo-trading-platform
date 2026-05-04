'use client'

import { useEffect, useState } from 'react'
import {
  getHealthIncidents,
  getHealthTimeline,
  getObservabilityEvents,
  getStrategyRuns,
} from '@/lib/api'
import type {
  DowntimeIncident,
  HealthTimelineEvent,
  ObservabilityEventEntry,
  StrategyRunHistoryEntry,
} from '@/lib/types'
import { cn, fmtPct, fmtPrice, fmtTime } from '@/lib/utils'

type JournalTab = 'events' | 'health' | 'strategy' | 'trades'

const TABS: Array<{ id: JournalTab; label: string }> = [
  { id: 'events', label: 'Event Log' },
  { id: 'health', label: 'Health Timeline' },
  { id: 'strategy', label: 'Strategy Runs' },
  { id: 'trades', label: 'Trade Journal' },
]

export function JournalWorkspace() {
  const [tab, setTab] = useState<JournalTab>('events')

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg">
      <div className="h-10 shrink-0 border-b border-border bg-panel/60 px-3 flex items-center gap-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'h-7 rounded-sm border px-2 font-mono text-[10px]',
              tab === item.id
                ? 'border-info/40 bg-info-dim text-info'
                : 'border-border bg-bg text-text-dim hover:text-text'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'events' && <EventLogPanel />}
        {tab === 'health' && <HealthTimelinePanel />}
        {tab === 'strategy' && <StrategyRunsPanel />}
        {tab === 'trades' && <TradeJournalPanel />}
      </div>
    </div>
  )
}

function EventLogPanel() {
  const [entries, setEntries] = useState<ObservabilityEventEntry[]>([])
  const [total, setTotal] = useState(0)
  const [eventType, setEventType] = useState('')
  const [symbol, setSymbol] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await getObservabilityEvents({
        event_type: eventType || undefined,
        symbol: symbol || undefined,
        limit,
        offset: page * limit,
      })
      if (!cancelled) {
        setEntries(data.entries)
        setTotal(data.total_matched)
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [eventType, page, symbol])

  return (
    <section className="h-full min-h-0 flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2 rounded-sm border border-border bg-panel/60 p-2">
        <div className="flex items-center gap-2">
          <select value={eventType} onChange={(event) => { setEventType(event.target.value); setPage(0) }} className="h-8 rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text">
            {['', 'TICK', 'SIGNAL', 'ERROR', 'GATEWAY_STATUS', 'PORTFOLIO'].map((item) => (
              <option key={item} value={item}>{item || 'All event types'}</option>
            ))}
          </select>
          <input
            value={symbol}
            onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setPage(0) }}
            placeholder="Symbol filter"
            className="h-8 rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text outline-none"
          />
        </div>
        <div className="font-mono text-[10px] text-text-faint">
          {total} matched / page {page + 1}
        </div>
      </div>
      <div className="h-7 grid grid-cols-[70px_95px_110px_100px_1fr_220px] gap-2 border border-border bg-bg px-3 items-center font-mono text-[9px] uppercase text-text-faint">
        <span>ID</span><span>Time</span><span>Type</span><span>Symbol</span><span>Summary</span><span>Details</span>
      </div>
      <div className="flex-1 overflow-auto border-x border-border">
        {entries.length === 0 ? (
          <EmptyRows text="No events match the current filters." />
        ) : entries.map((entry) => (
          <div key={entry.id} className="grid min-h-8 grid-cols-[70px_95px_110px_100px_1fr_220px] gap-2 border-b border-border/60 px-3 py-1.5 font-mono text-[10px]">
            <span className="text-text-faint">{entry.id}</span>
            <span className="text-text-faint">{fmtTime(entry.ts)}</span>
            <span className="text-info">{entry.event_type}</span>
            <span className="text-text-dim">{entry.symbol || '-'}</span>
            <span className="truncate text-text">{entry.summary}</span>
            <span className="truncate text-text-faint">{entry.payload_preview}</span>
          </div>
        ))}
      </div>
      <div className="h-9 shrink-0 border border-border bg-panel/60 px-3 flex items-center justify-between">
        <button disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))} className="rounded-sm border border-border bg-bg px-2 py-1 font-mono text-[10px] text-text-dim disabled:opacity-40">
          Prev
        </button>
        <button disabled={(page + 1) * limit >= total} onClick={() => setPage((value) => value + 1)} className="rounded-sm border border-border bg-bg px-2 py-1 font-mono text-[10px] text-text-dim disabled:opacity-40">
          Next
        </button>
      </div>
    </section>
  )
}

function HealthTimelinePanel() {
  const [events, setEvents] = useState<HealthTimelineEvent[]>([])
  const [incidents, setIncidents] = useState<DowntimeIncident[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [timeline, incidentData] = await Promise.all([getHealthTimeline(undefined, 100), getHealthIncidents()])
      if (!cancelled) {
        setEvents(timeline.events)
        setIncidents(incidentData)
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="h-full min-h-0 overflow-auto p-3 space-y-3">
      <section className="rounded-sm border border-border bg-panel/60">
        <PanelTitle title="Incidents" subtitle="Disconnect/error intervals in this session" />
        <div className="p-2 space-y-1">
          {incidents.length === 0 ? <EmptyRows text="No incidents recorded this session." /> : incidents.map((incident) => (
            <div key={`${incident.component}-${incident.started_at}`} className="grid grid-cols-[120px_130px_130px_1fr] gap-2 rounded-sm border border-border bg-bg px-2 py-1.5 font-mono text-[10px]">
              <span className="uppercase text-warn">{incident.component}</span>
              <span>{fmtTime(incident.started_at)}</span>
              <span>{incident.ended_at ? fmtTime(incident.ended_at) : 'OPEN'}</span>
              <span className="text-text-faint">{incident.duration_seconds == null ? 'open' : `${incident.duration_seconds.toFixed(1)}s`}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-border bg-panel/60">
        <PanelTitle title="Timeline" subtitle="State transition history" />
        <div className="p-2 space-y-1">
          {events.length === 0 ? <EmptyRows text="No health timeline events recorded." /> : events.map((event, index) => (
            <div key={`${event.ts}-${index}`} className="grid grid-cols-[110px_34px_120px_1fr] gap-2 rounded-sm border border-border bg-bg px-2 py-1.5 font-mono text-[10px]">
              <span className="text-text-faint">{fmtTime(event.ts)}</span>
              <span className="text-text-faint">&lt;-&gt;</span>
              <span className={stateClass(event.state)}>{event.component}: {event.state}</span>
              <span className="truncate text-text-dim">{event.detail || '-'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StrategyRunsPanel() {
  const [runs, setRuns] = useState<StrategyRunHistoryEntry[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await getStrategyRuns()
      if (!cancelled) setRuns(data.runs)
    }
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <section className="h-full min-h-0 overflow-auto p-3">
      <div className="mb-2 rounded-sm border border-border bg-info-dim px-3 py-2 font-mono text-[10px] text-info">
        Research backtests only. No live execution.
      </div>
      <div className="rounded-sm border border-border bg-panel/60">
        <div className="grid grid-cols-[120px_160px_100px_80px_70px_90px_90px_90px] gap-2 border-b border-border bg-bg px-3 py-1.5 font-mono text-[9px] uppercase text-text-faint">
          <span>Time</span><span>Strategy</span><span>Symbol</span><span>TF</span><span>Trades</span><span>Net PnL</span><span>Return%</span><span>Max DD</span>
        </div>
        {runs.length === 0 ? <EmptyRows text="No strategy runs recorded this session." /> : runs.map((run, index) => {
          const key = `${run.ts}-${index}`
          return (
            <button key={key} onClick={() => setExpanded(expanded === key ? null : key)} className="block w-full border-b border-border/60 text-left hover:bg-bg">
              <div className="grid grid-cols-[120px_160px_100px_80px_70px_90px_90px_90px] gap-2 px-3 py-1.5 font-mono text-[10px]">
                <span className="text-text-faint">{fmtTime(run.ts)}</span>
                <span className="text-text">{run.strategy_name}</span>
                <span>{run.symbol}</span>
                <span>{run.timeframe}</span>
                <span>{run.metrics.total_trades ?? 0}</span>
                <span>{fmtPrice(run.metrics.net_pnl ?? null)}</span>
                <span>{fmtPct(run.metrics.total_return_pct ?? null)}</span>
                <span>{fmtPct(run.metrics.max_drawdown ?? null)}</span>
              </div>
              {expanded === key && (
                <pre className="mx-3 mb-2 overflow-auto rounded-sm border border-border bg-bg p-2 text-[10px] text-text-faint">
                  {JSON.stringify(run.metrics, null, 2)}
                </pre>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TradeJournalPanel() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div>
        <div className="text-sm font-semibold text-text">Paper trades will appear here after orders are placed.</div>
        <div className="mt-2 font-mono text-[10px] text-text-faint">
          Journal data is session-scoped. Not persisted on Render Free.
        </div>
      </div>
    </div>
  )
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-border bg-bg/70 px-3 py-2">
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="font-mono text-[9px] text-text-faint">{subtitle}</div>
    </div>
  )
}

function EmptyRows({ text }: { text: string }) {
  return <div className="p-4 text-center font-mono text-[10px] text-text-faint">{text}</div>
}

function stateClass(state: string): string {
  if (state === 'CONNECTED') return 'text-up'
  if (state === 'ERROR') return 'text-down'
  return 'text-warn'
}
