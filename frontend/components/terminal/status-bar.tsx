'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Wifi,
  WifiOff,
  Server,
  Cpu,
  Layers,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtAge, cn, marketSessionLabel } from '@/lib/utils'
import { BUILD_ENV, WORKSPACES } from '@/lib/constants'
import type { WsConnectionStatus, StatusSource } from '@/lib/types'

export function StatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const reconnect = useTerminalStore((s) => s.reconnectAttempt)
  const statusSource = useTerminalStore((s) => s.statusSource)
  const backendOffline = useTerminalStore((s) => s.backendOffline)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const status = useTerminalStore((s) => s.terminalStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const mode = useTerminalStore((s) => s.executionMode)
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const ws = useTerminalStore((s) => s.activeWorkspace)
  const portfolioSummary = useTerminalStore((s) => s.portfolioSummary)

  // tick to refresh "age"
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const tickAge = lastTickAt ? Date.now() - lastTickAt : null
  const tick = status?.tick_bus
  const dropPct = tick?.drop_rate_pct ?? null
  const wsLabelObj = WORKSPACES.find((w) => w.id === ws)
  const apiStatus = backendOffline ? 'OFFLINE' : 'OK'
  const brokerValue = broker
    ? broker.logged_in
      ? 'LOGGED IN'
      : 'OFFLINE'
    : '\u2014'
  const session = marketSessionLabel()
  const ageValue = lastTickAt ? fmtAge(tickAge) : session === 'LIVE' ? '\u2014' : session

  return (
    <footer className="h-statusbar shrink-0 px-2 flex items-center gap-2 bg-bg-2 border-t border-border text-[10px] font-mono">
      <WsIndicator status={wsStatus} attempts={reconnect} connected={wsConnected} />
      <Separator />
      <StatusItem label="API" value={apiStatus} tone={backendOffline ? 'bad' : 'ok'} />
      <StatusItem
        label="BRK"
        value={brokerValue}
        tone={broker?.logged_in ? 'ok' : broker ? 'muted' : 'muted'}
        source={statusSource}
      />
      <StatusItem label="TICKS" value={tick?.total ?? '\u2014'} />
      <StatusItem
        label="DROP"
        value={dropPct == null ? '\u2014' : `${dropPct.toFixed(2)}%`}
        tone={dropPct != null && dropPct > 5 ? 'warn' : 'default'}
      />
      <StatusItem label="AGE" value={ageValue} tone={lastTickAt ? 'default' : session === 'LIVE' ? 'muted' : 'warn'} />
      <Separator />

      <span className="ml-auto" />

      <Cell className="text-text-2">
        <Layers className="w-3 h-3" />
        <span>WORKSPACE</span>
        <span className="text-text">{wsLabelObj?.label ?? '\u2014'}</span>
      </Cell>

      <Cell className="text-text-2">
        <span>SYM</span>
        <span className="text-text">{selected ?? '\u2014'}</span>
      </Cell>

      <Cell className={portfolioSummary?.net_pnl != null && portfolioSummary.net_pnl < 0 ? 'text-down' : 'text-text-2'}>
        <span>NET PNL</span>
        <span className="text-text">{portfolioSummary?.net_pnl == null ? '\u2014' : portfolioSummary.net_pnl.toFixed(2)}</span>
      </Cell>

      <ModeIndicator mode={mode} />

      <Cell className="text-text-faint">
        <span>{BUILD_ENV}</span>
        <span>/</span>
        <span>v0.2 / MAET.OS</span>
      </Cell>
    </footer>
  )
}

function WsIndicator({
  status,
  attempts,
  connected,
}: {
  status: WsConnectionStatus
  attempts: number
  connected: boolean
}) {
  const label =
    status === 'RECONNECTING'
      ? `RECONNECTING (${attempts})`
      : status === 'CONNECTING'
      ? 'CONNECTING'
      : status === 'CONNECTED'
      ? 'CONNECTED'
      : 'OFFLINE'
  return (
    <Cell className={statusTone(status)}>
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>WS</span>
      <span>{label}</span>
    </Cell>
  )
}

function StatusItem({
  label,
  value,
  tone = 'default',
  source,
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'ok' | 'warn' | 'bad' | 'muted'
  source?: StatusSource
}) {
  return (
    <Cell className={toneClass(tone)}>
      <span className="text-text-faint">{label}</span>
      <span className="tnum text-text">{value}</span>
      {source === 'REST' && (
        <span className="rounded border border-info/25 bg-info-dim px-1 text-[8px] text-info">
          REST
        </span>
      )}
    </Cell>
  )
}

function Separator() {
  return <span className="h-4 w-px bg-border" />
}

function ModeIndicator({ mode }: { mode: 'PAPER' | 'LIVE' }) {
  return (
    <Cell className={cn(mode === 'LIVE' ? 'text-live' : 'text-paper')}>
      <Cpu className="w-3 h-3" />
      <span>MODE</span>
      <span>{mode}</span>
    </Cell>
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

function statusTone(status: WsConnectionStatus): string {
  if (status === 'CONNECTED') return 'text-up'
  if (status === 'CONNECTING' || status === 'RECONNECTING') return 'text-warn'
  return 'text-down'
}

function toneClass(tone: 'default' | 'ok' | 'warn' | 'bad' | 'muted') {
  if (tone === 'ok') return 'text-up'
  if (tone === 'warn') return 'text-warn'
  if (tone === 'bad') return 'text-down'
  if (tone === 'muted') return 'text-text-dim'
  return 'text-text-2'
}
