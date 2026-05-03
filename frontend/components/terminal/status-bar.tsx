'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  Wifi,
  WifiOff,
  Server,
  Cpu,
  Clock,
  Layers,
  CircleDot,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtAge, cn, qualityFromAge } from '@/lib/utils'
import { BUILD_ENV, WORKSPACES } from '@/lib/constants'

export function StatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const reconnect = useTerminalStore((s) => s.wsReconnectAttempts)
  const backendOffline = useTerminalStore((s) => s.backendOffline)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const status = useTerminalStore((s) => s.terminalStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const mode = useTerminalStore((s) => s.executionMode)
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const ws = useTerminalStore((s) => s.activeWorkspace)

  // tick to refresh "age"
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const tickAge = lastTickAt ? Date.now() - lastTickAt : null
  const quality = qualityFromAge(lastTickAt, !backendOffline, false)
  const tick = status?.tick_bus
  const dropPct = tick?.drop_rate_pct ?? null

  const wsLabel = wsConnected
    ? quality === 'STALE'
      ? 'STALE'
      : 'LIVE'
    : reconnect > 0
    ? `RECONNECT ${reconnect}`
    : 'OFFLINE'

  const wsCls = wsConnected
    ? quality === 'STALE'
      ? 'text-warn'
      : 'text-up'
    : 'text-down'

  const wsLabelObj = WORKSPACES.find((w) => w.id === ws)

  return (
    <footer className="h-statusbar shrink-0 px-2 flex items-center gap-3 bg-bg-2 border-t border-border text-[10px] font-mono">
      {/* Left cluster */}
      <Cell className={wsCls}>
        {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        <span>WS</span>
        <span>{wsLabel}</span>
      </Cell>

      <Cell className={backendOffline ? 'text-down' : 'text-text-2'}>
        <Server className="w-3 h-3" />
        <span>API</span>
        <span>{backendOffline ? 'OFFLINE' : 'OK'}</span>
      </Cell>

      <Cell className={broker?.logged_in ? 'text-up' : 'text-text-dim'}>
        <CircleDot className="w-3 h-3" />
        <span>BRK</span>
        <span>
          {broker
            ? broker.logged_in
              ? 'LOGGED IN'
              : 'OFFLINE'
            : '\u2014'}
        </span>
      </Cell>

      <Cell className="text-text-2">
        <Activity className="w-3 h-3" />
        <span>TICKS</span>
        <span className="tnum text-text">
          {tick?.total ?? '\u2014'}
        </span>
        <span className="text-text-faint">DROP</span>
        <span
          className={cn(
            'tnum',
            dropPct == null
              ? 'text-text-faint'
              : dropPct > 5
              ? 'text-warn'
              : 'text-text'
          )}
        >
          {dropPct == null ? '\u2014' : `${dropPct.toFixed(2)}%`}
        </span>
      </Cell>

      <Cell className="text-text-2">
        <Clock className="w-3 h-3" />
        <span>TICK AGE</span>
        <span className="tnum text-text">{fmtAge(tickAge)}</span>
      </Cell>

      {/* Spacer */}
      <span className="ml-auto" />

      {/* Right cluster */}
      <Cell className="text-text-2">
        <Layers className="w-3 h-3" />
        <span>WS</span>
        <span className="text-text">{wsLabelObj?.label ?? '\u2014'}</span>
      </Cell>

      <Cell className="text-text-2">
        <span>SYM</span>
        <span className="text-text">{selected ?? '\u2014'}</span>
      </Cell>

      <Cell
        className={cn(
          mode === 'LIVE' ? 'text-live' : 'text-paper'
        )}
      >
        <Cpu className="w-3 h-3" />
        <span>MODE</span>
        <span>{mode}</span>
      </Cell>

      <Cell className="text-text-faint">
        <span>{BUILD_ENV}</span>
        <span>/</span>
        <span>v0.2 / MAET.OS</span>
      </Cell>
    </footer>
  )
}

function Cell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      {children}
    </span>
  )
}
