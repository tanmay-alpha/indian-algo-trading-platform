'use client'

import { useEffect, useRef, useState } from 'react'
import { WORKSPACES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useNow } from '@/lib/use-now'
import { useTerminalStore } from '@/store/terminal-store'

export function StatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const portfolioSummary = useTerminalStore((s) => s.portfolioSummary)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const mode = useTerminalStore((s) => s.executionMode)
  const now = useNow()
  const previousApiStatus = useRef(apiStatus)
  const [apiFlash, setApiFlash] = useState(false)

  const tickCount = status?.tick_bus?.total ?? status?.gateway?.tick_count ?? null
  const dropRate = status?.tick_bus?.drop_rate_pct ?? status?.gateway?.drop_rate_pct ?? null
  const tickAge = lastTickAt
    ? (now - lastTickAt) / 1000
    : status?.gateway?.last_tick_age_seconds ?? null
  const brokerOnline = Boolean(broker?.logged_in)
  const workspace = WORKSPACES.find((item) => item.id === activeWorkspace)?.short ?? activeWorkspace
  const netPnl = portfolioSummary?.net_pnl ?? null
  const apiOnline = apiStatus === 'ONLINE'
  const wsOnline = wsConnected || wsStatus === 'CONNECTED'
  const modeTone = mode === 'LIVE'
    ? 'border-down bg-down-dim text-down'
    : 'border-info bg-info-dim text-info'

  useEffect(() => {
    if (apiStatus === 'ONLINE' && previousApiStatus.current !== 'ONLINE') {
      setApiFlash(true)
      const timer = window.setTimeout(() => setApiFlash(false), 600)
      previousApiStatus.current = apiStatus
      return () => window.clearTimeout(timer)
    }
    previousApiStatus.current = apiStatus
    return undefined
  }, [apiStatus])

  return (
    <footer className="hidden h-[26px] shrink-0 items-stretch border-t border-[var(--border)] bg-[var(--bg-void)] font-mono md:flex">
      <StatusCell
        label="WS"
        value={wsOnline ? 'WS CONNECTED' : 'CONNECTING'}
        dot={wsOnline ? 'up' : 'warn'}
        valueClass={wsOnline ? 'text-up' : 'text-warn'}
      />
      <StatusCell
        label="API"
        value={apiOnline ? 'ONLINE' : 'CONNECTING'}
        dot={apiOnline ? 'up' : 'warn'}
        valueClass={cn(apiOnline ? 'text-up' : 'text-warn', apiFlash && 'flash-up')}
      />
      <StatusCell
        label="BRK"
        value={brokerOnline ? 'ONLINE' : 'WAIT'}
        dot={brokerOnline ? 'up' : 'warn'}
        valueClass={brokerOnline ? 'text-up' : 'text-warn'}
      />
      <StatusCell label="TICKS" value={tickCount ?? '—'} valueClass="tabular-nums text-[var(--text-2)]" />
      <StatusCell
        label="DROP"
        value={dropRate != null ? `${dropRate.toFixed(2)}%` : '—'}
        valueClass={cn('tabular-nums', dropRate != null && dropRate > 1 ? 'text-warn' : 'text-[var(--text-2)]')}
      />
      <StatusCell
        label="AGE"
        value={tickAge != null ? `${tickAge.toFixed(0)}s` : '—'}
        valueClass={cn('tabular-nums', tickAge != null && tickAge > 30 ? 'text-warn' : 'text-[var(--text-2)]')}
      />

      <div className="flex-1" />

      <StatusCell label="WORKSPACE" value={workspace} valueClass="text-[var(--text-2)]" side="left" />
      <StatusCell label="SYM" value={selectedSymbol ?? '—'} valueClass="font-semibold text-[var(--text-1)]" side="left" />
      <StatusCell
        label="PNL"
        value={netPnl != null ? `₹${netPnl.toFixed(2)}` : '—'}
        valueClass={cn('tabular-nums', netPnl != null && netPnl > 0 ? 'text-up' : netPnl != null && netPnl < 0 ? 'text-down' : 'text-[var(--text-2)]')}
        side="left"
      />
      <div className="flex shrink-0 items-center border-l border-[var(--border)] px-2">
        <span className={cn('rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-widest', modeTone)}>
          {mode}
        </span>
      </div>
    </footer>
  )
}

function StatusCell({
  label,
  value,
  valueClass,
  dot,
  side = 'right',
}: {
  label: string
  value: string | number
  valueClass?: string
  dot?: 'up' | 'warn' | 'down' | 'locked'
  side?: 'left' | 'right'
}) {
  const dotClass = dot === 'up'
    ? 'bg-up animate-pulse-soft'
    : dot === 'warn'
    ? 'bg-warn'
    : dot === 'down'
    ? 'bg-down'
    : dot === 'locked'
    ? 'bg-locked'
    : ''

  return (
    <div
      className={cn(
        'flex h-full shrink-0 items-center gap-1.5 px-2',
        side === 'left' ? 'border-l border-[var(--border)]' : 'border-r border-[var(--border)]'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />}
      <span className="text-[9px] uppercase leading-none text-[var(--text-3)]">{label}</span>
      <span className={cn('text-[10px] font-semibold leading-none text-[var(--text-2)]', valueClass)}>{value}</span>
    </div>
  )
}
