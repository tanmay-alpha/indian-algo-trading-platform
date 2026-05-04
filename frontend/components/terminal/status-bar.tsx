'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Wifi,
  WifiOff,
  Cpu,
  Layers,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtAge, cn, marketSessionLabel, uiStatusMeta } from '@/lib/utils'
import { BUILD_ENV, WORKSPACES } from '@/lib/constants'
import type { WsConnectionStatus, StatusSource } from '@/lib/types'

export function StatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const reconnect = useTerminalStore((s) => s.reconnectAttempt)
  const statusSource = useTerminalStore((s) => s.statusSource)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
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
  const apiLabel = apiStatus === 'UNKNOWN'
    ? backendWakeState === 'WAKING'
      ? 'WAKING'
      : 'CONNECTING'
    : apiStatus
  const brokerValue = broker
    ? broker.logged_in
      ? 'ONLINE'
      : 'OFFLINE'
    : apiStatus === 'ONLINE'
    ? 'WAITING'
    : apiLabel
  const session = marketSessionLabel()
  const feedValue = session === 'LIVE'
    ? broker?.feed_token_available
      ? 'LIVE'
      : broker
      ? 'WAITING'
      : apiLabel
    : session
  const tickValue = lastTickAt
    ? tickAge != null && tickAge > 12_000
      ? 'STALE'
      : 'LIVE'
    : session === 'LIVE'
    ? apiStatus === 'ONLINE'
      ? 'WAITING'
      : apiLabel
    : session
  const ageValue = lastTickAt ? fmtAge(tickAge) : session === 'LIVE' ? '\u2014' : session
  const candleValue = status?.candles ? 'READY' : apiStatus === 'ONLINE' ? 'WAITING' : apiLabel

  return (
    <footer className="h-statusbar shrink-0 overflow-x-auto px-2 flex items-center gap-2 bg-bg-2 border-t border-border text-[10px] font-mono">
      <WsIndicator status={wsStatus} attempts={reconnect} connected={wsConnected} />
      <Separator />
      <StatusItem label="API" value={apiLabel} />
      <StatusItem
        label="BRK"
        value={brokerValue}
        source={statusSource}
      />
      <StatusItem label="FEED" value={feedValue} source={statusSource} />
      <StatusItem label="TICK" value={tickValue} />
      <StatusItem label="COUNT" value={tick?.total ?? '\u2014'} />
      <StatusItem
        label="DROP"
        value={dropPct == null ? '\u2014' : `${dropPct.toFixed(2)}%`}
        tone={dropPct != null && dropPct > 5 ? 'warn' : 'default'}
      />
      <StatusItem label="AGE" value={ageValue} />
      <StatusItem label="CDL" value={candleValue} />
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
      <StatusItem label="LOCK" value="LOCKED" />

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
  source,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  source?: StatusSource
  tone?: 'default' | 'warn'
}) {
  const meta = uiStatusMeta(typeof value === 'string' ? value : undefined)
  return (
    <Cell className={tone === 'warn' ? 'text-warn border-warn/20 bg-warn-dim' : meta.badgeClass}>
      <span className="text-text-faint">{label}:</span>
      <span className="tnum text-text">{value}</span>
      {(source === 'REST' || source === 'REST_FALLBACK') && (
        <span className="rounded border border-info/25 bg-info-dim px-1 text-[8px] text-info">
          {source === 'REST_FALLBACK' ? 'REST' : 'REST'}
        </span>
      )}
    </Cell>
  )
}

function Separator() {
  return <span className="h-4 w-px shrink-0 bg-border" />
}

function ModeIndicator({ mode }: { mode: 'PAPER' | 'LIVE' }) {
  return (
    <Cell className={cn(mode === 'LIVE' ? 'text-live' : 'text-paper')}>
      <Cpu className="w-3 h-3" />
      <span>MODE:</span>
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
    <span className={cn('inline-flex min-w-fit items-center gap-1.5 whitespace-nowrap rounded-sm border border-border bg-panel/55 px-2 h-6', className)}>
      {children}
    </span>
  )
}

function statusTone(status: WsConnectionStatus): string {
  if (status === 'CONNECTED') return 'text-up'
  if (status === 'CONNECTING' || status === 'RECONNECTING') return 'text-warn'
  return 'text-down'
}
