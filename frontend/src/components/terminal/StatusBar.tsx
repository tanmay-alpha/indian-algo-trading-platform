'use client'

import { useTerminalStore } from '@/store/terminal-store'

const VERSION = 'v0.1'

export function StatusBar() {
  const wsStatus = useTerminalStore((state) => state.wsStatus)
  const reconnectInSeconds = useTerminalStore((state) => state.wsReconnectInSeconds)
  const tickCount = useTerminalStore((state) => state.tickCount)
  const dayPnl = useTerminalStore((state) => state.dayPnl)
  const status = normalizeStatus(wsStatus)
  const positive = dayPnl >= 0
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
      ? 'connected'
      : status === 'connecting'
      ? 'connecting'
      : status === 'offline'
      ? 'offline'
      : 'degraded'

  return (
    <footer className="flex h-8 shrink-0 items-center border-t border-border bg-panel font-mono text-[10px] text-text-muted">
      <div className="flex items-center gap-4 px-4">
        <span className="flex items-center gap-1.5">
          <span className={`h-[5px] w-[5px] rounded-full ${dotClass}`} />
          <span>WS {label}</span>
        </span>
        <span>Feed: {tickCount.toLocaleString('en-IN')} ticks</span>
        <span>Broker: paper</span>
        <span>Engine: C++ ready</span>
      </div>

      <div className="ml-auto flex items-center gap-4 px-4">
        <span className={positive ? 'text-up' : 'text-dn'}>
          P&amp;L {positive ? '+' : ''}{dayPnl.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span>{VERSION}</span>
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
