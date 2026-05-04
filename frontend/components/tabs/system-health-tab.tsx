'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getHealthIncidents,
  getHealthTimeline,
  getObservabilityErrors,
  getObservabilityEvents,
  getObservabilityMetrics,
  getObservabilityStatus,
} from '@/lib/api'
import type {
  DowntimeIncident,
  HealthTimelineEvent,
  ObservabilityEventEntry,
  ObservabilityMetricsResponse,
  ObservabilityStatus,
} from '@/lib/types'
import { cn, fmtTime } from '@/lib/utils'

type EventFilter = 'ALL' | 'TICK' | 'SIGNAL' | 'ERROR' | 'GATEWAY_STATUS'

export function SystemHealthTab() {
  const [metrics, setMetrics] = useState<ObservabilityMetricsResponse | null>(null)
  const [status, setStatus] = useState<ObservabilityStatus | null>(null)
  const [events, setEvents] = useState<ObservabilityEventEntry[]>([])
  const [timeline, setTimeline] = useState<HealthTimelineEvent[]>([])
  const [incidents, setIncidents] = useState<DowntimeIncident[]>([])
  const [filter, setFilter] = useState<EventFilter>('ALL')
  const eventListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [metricData, statusData, timelineData, incidentData, eventData] = await Promise.all([
        getObservabilityMetrics(),
        getObservabilityStatus(),
        getHealthTimeline(undefined, 10),
        getHealthIncidents(),
        filter === 'ERROR'
          ? getObservabilityErrors(50)
          : getObservabilityEvents({ event_type: filter === 'ALL' ? undefined : filter, limit: 50 }),
      ])
      if (cancelled) return
      setMetrics(metricData)
      setStatus(statusData)
      setTimeline(timelineData.events)
      setIncidents(incidentData)
      setEvents(eventData.entries)
    }
    void load()
    const id = window.setInterval(() => void load(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [filter])

  useEffect(() => {
    const node = eventListRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [events])

  const latest = metrics?.summary.latest || {}
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-3 p-3">
      <section className="min-h-0 overflow-auto rounded-sm border border-border bg-panel/60">
        <PanelHeader title="Metrics Overview" subtitle="Rolling in-memory observability" />
        <div className="grid grid-cols-5 gap-2 p-3">
          <MetricCard label="Tick Rate" value={`${latest.tick_rate ?? 0} / min`} />
          <MetricCard label="WS Clients" value={String(latest.ws_client_count ?? 0)} />
          <MetricCard label="Events" value={`${latest.event_bus_total ?? 0} total`} sub={`${latest.event_fail_count ?? 0} failed`} />
          <MetricCard label="Uptime" value={formatUptime(status?.uptime_seconds ?? metrics?.summary.uptime_seconds ?? 0)} />
          <MetricCard label="Errors" value={String(status?.error_count ?? 0)} />
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <SparkPanel label="Tick Rate" points={(metrics?.series.tick_rate || []).slice(-30).map((point) => Number(point.value || 0))} />
          <SparkPanel label="WS Clients" points={(metrics?.series.ws_client_count || []).slice(-30).map((point) => Number(point.value || 0))} />
        </div>

        <div className="grid grid-cols-2 gap-3 px-3 pb-3">
          <section className="rounded-sm border border-border bg-bg/70">
            <PanelHeader title="Health Timeline" subtitle="Latest state transitions" compact />
            <div className="max-h-[220px] overflow-auto p-2 space-y-1">
              {timeline.length === 0 ? (
                <EmptyLine text="No health state changes recorded." />
              ) : (
                timeline.slice(-10).map((event, index) => <TimelineRow key={`${event.ts}-${index}`} event={event} />)
              )}
            </div>
          </section>

          <section className="rounded-sm border border-border bg-bg/70">
            <PanelHeader title="Downtime Incidents" subtitle="Session scoped" compact />
            <div className="max-h-[220px] overflow-auto p-2 space-y-1">
              {incidents.length === 0 ? (
                <EmptyLine text="No incidents recorded this session." />
              ) : (
                incidents.map((incident) => (
                  <div key={`${incident.component}-${incident.started_at}`} className="rounded-sm border border-border bg-panel/70 px-2 py-1.5 font-mono text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="uppercase text-warn">{incident.component}</span>
                      <span className="text-text-faint">{incident.duration_seconds == null ? 'OPEN' : `${incident.duration_seconds.toFixed(1)}s`}</span>
                    </div>
                    <div className="mt-1 text-text-faint">{fmtTime(incident.started_at)} - {incident.ended_at ? fmtTime(incident.ended_at) : 'open'}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      <aside className="min-h-0 overflow-hidden rounded-sm border border-border bg-panel/60">
        <div className="flex h-10 items-center justify-between border-b border-border bg-bg/70 px-3">
          <div>
            <div className="text-xs font-semibold text-text">Event Log</div>
            <div className="text-[9px] font-mono text-text-faint">Last 50 entries</div>
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as EventFilter)}
            className="h-7 rounded-sm border border-border bg-bg px-2 font-mono text-[10px] text-text"
          >
            {['ALL', 'TICK', 'SIGNAL', 'ERROR', 'GATEWAY_STATUS'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div ref={eventListRef} className="h-[calc(100%-82px)] overflow-auto p-2 space-y-1">
          {events.length === 0 ? (
            <EmptyLine text="No events recorded." />
          ) : (
            events.map((entry) => <EventRow key={entry.id} entry={entry} />)
          )}
        </div>
        <div className="h-[42px] border-t border-border bg-bg/70 px-3 flex items-center justify-between font-mono text-[10px]">
          <span className="text-text-faint">Total errors: <span className="text-down">{status?.error_count ?? 0}</span></span>
          <button onClick={() => setFilter('ERROR')} className="rounded-sm border border-border bg-panel px-2 py-1 text-text-dim hover:text-text">
            View all errors
          </button>
        </div>
      </aside>
    </div>
  )
}

function PanelHeader({ title, subtitle, compact = false }: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={cn('border-b border-border bg-bg/70 px-3', compact ? 'py-1.5' : 'py-2')}>
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="text-[9px] font-mono text-text-faint">{subtitle}</div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-sm border border-border bg-bg p-2 font-mono">
      <div className="text-[9px] uppercase text-text-faint">{label}</div>
      <div className="mt-1 text-xs text-text">{value}</div>
      {sub && <div className="mt-0.5 text-[9px] text-text-faint">{sub}</div>}
    </div>
  )
}

function SparkPanel({ label, points }: { label: string; points: number[] }) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border bg-bg p-2">
      <div className="font-mono text-[10px] text-text-faint">{label}</div>
      <svg width="120" height="30" viewBox="0 0 120 30" role="img" aria-label={`${label} sparkline`}>
        <polyline points={pointsToSvgPolyline(points, 120, 30)} fill="none" stroke="#16c784" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function TimelineRow({ event }: { event: HealthTimelineEvent }) {
  return (
    <div className="grid grid-cols-[58px_52px_18px_1fr] items-center gap-2 rounded-sm border border-border bg-panel/70 px-2 py-1.5 font-mono text-[10px]">
      <span className="text-text-faint">{fmtTime(event.ts)}</span>
      <span className="text-info">{componentBadge(event.component)}</span>
      <span className={cn('h-2 w-2 rounded-full', stateDot(event.state))} />
      <span className="truncate text-text-dim">{event.state} {event.detail}</span>
    </div>
  )
}

function EventRow({ entry }: { entry: ObservabilityEventEntry }) {
  return (
    <div className="rounded-sm border border-border bg-bg px-2 py-1.5 font-mono text-[10px]">
      <div className="flex items-center gap-2">
        <span className={cn('rounded border px-1.5 py-0.5 text-[9px]', eventTypeClass(entry.event_type))}>{entry.event_type}</span>
        <span className="text-text-faint">{fmtTime(entry.ts)}</span>
      </div>
      <div className="mt-1 truncate text-text-2">{entry.summary}</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-sm border border-border bg-bg px-2 py-2 text-center font-mono text-[10px] text-text-faint">{text}</div>
}

export function pointsToSvgPolyline(points: number[], w: number, h: number): string {
  if (points.length === 0) return ''
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = Math.max(max - min, 1)
  return points.map((value, index) => {
    const x = points.length === 1 ? w / 2 : (index / (points.length - 1)) * w
    const y = h - ((value - min) / span) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function eventTypeClass(type: string): string {
  if (type === 'ERROR') return 'border-down/25 bg-down-dim text-down'
  if (type === 'SIGNAL') return 'border-warn/25 bg-warn-dim text-warn'
  if (type === 'GATEWAY_STATUS') return 'border-up/20 bg-up-dim text-up'
  if (type === 'PORTFOLIO') return 'border-info/20 bg-info-dim text-info'
  return 'border-border bg-panel text-text-dim'
}

function stateDot(state: string): string {
  if (state === 'CONNECTED') return 'bg-up'
  if (state === 'ERROR') return 'bg-down'
  return 'bg-warn'
}

function componentBadge(component: string): string {
  if (component === 'gateway') return 'GW'
  if (component === 'websocket') return 'WS'
  if (component === 'session') return 'SESSION'
  if (component === 'broker') return 'BROKER'
  return component.toUpperCase()
}

function formatUptime(seconds: number): string {
  const safe = Math.max(Number(seconds || 0), 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${hours}h ${minutes}m`
}
