'use client'

import { useTerminalStore } from '@/store/terminal-store'

interface StatusBarProps {
  ticks: number
  dayPnl: number
  version?: string
}

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export function StatusBar({ ticks, dayPnl, version = 'v0.2' }: StatusBarProps) {
  const positive = dayPnl >= 0
  const wsStatus = useTerminalStore((state) => state.wsStatus)
  const reconnectInSeconds = useTerminalStore((state) => state.wsReconnectInSeconds)
  const status = normalizeStatus(wsStatus)
  const dotClass =
    status === 'connected'
      ? 'bg-up'
      : status === 'offline'
      ? 'bg-dn'
      : 'bg-warn'
  const label =
    reconnectInSeconds != null && status === 'degraded'
      ? `reconnecting in ${reconnectInSeconds}s`
      : status === 'connected'
      ? 'WS connected'
      : status === 'connecting'
      ? 'WS connecting'
      : status === 'offline'
      ? 'WS offline'
      : 'WS degraded'

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-panel px-4 font-mono text-[10px] text-muted">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span>{label}</span>
        </span>
        <span className="h-3 w-px bg-border-strong" />
        <span>Feed: {ticks.toLocaleString('en-IN')} ticks</span>
        <span className="h-3 w-px bg-border-strong" />
        <span>Broker: paper</span>
        <span className="h-3 w-px bg-border-strong" />
        <span>Engine: ready</span>
      </div>

      <div className="flex items-center gap-3">
        <span className={positive ? 'text-up' : 'text-dn'}>
          Day P&amp;L: {positive ? '+' : ''}{formatMoney(dayPnl)}
        </span>
        <span className="h-3 w-px bg-border-strong" />
        <span>{version}</span>
      </div>
    </footer>
  )
}

function normalizeStatus(status: string) {
  if (status === 'CONNECTED' || status === 'connected') return 'connected'
  if (status === 'CONNECTING' || status === 'connecting') return 'connecting'
  if (status === 'OFFLINE' || status === 'offline') return 'offline'
  return 'degraded'
}
