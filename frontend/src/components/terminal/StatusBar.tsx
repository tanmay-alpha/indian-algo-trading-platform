'use client'

import { useTerminalStore } from '@/store/terminal-store'

const VERSION = 'v0.2'

export function StatusBar() {
  const wsStatus = useTerminalStore((state) => state.wsStatus)
  const reconnectInSeconds = useTerminalStore((state) => state.wsReconnectInSeconds)
  const wsAttempts = useTerminalStore((state) => state.wsReconnectAttempts)
  const connectionError = useTerminalStore((state) => state.connectionError)
  const tickCount = useTerminalStore((state) => state.tickCount)
  const dayPnl = useTerminalStore((state) => state.dayPnl)
  const demoMode = useTerminalStore((state) => state.wsDemoMode)
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
      ? `demo feed, retry ${reconnectInSeconds}s`
      : status === 'connected'
      ? 'connected'
      : status === 'connecting'
      ? 'warming'
      : status === 'offline'
      ? 'offline'
      : 'demo feed'

  // When the auto-reconnect cap is reached, the hook stops scheduling retries
  // and the connectionError string starts with "reconnect paused". Show an
  // explicit Retry button so the user isn't stuck.
  const reconnectPaused =
    status === 'offline' &&
    typeof connectionError === 'string' &&
    connectionError.startsWith('reconnect paused')

  // PnL is only authoritative when we are connected to the real broker feed.
  // In demo / warming / degraded mode the PnL is simulated (random walk or
  // paper-check deltas) and must not be mistaken for live P&L.
  const pnlIsLive = status === 'connected' && !demoMode
  const pnlAriaLabel = pnlIsLive
    ? `Day P&L: ${dayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `Simulated day P&L (demo feed, not live): ${dayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <footer className="flex h-8 shrink-0 items-center overflow-x-auto whitespace-nowrap border-t border-border bg-panel font-mono text-[10px] text-text-muted">
      <div className="flex min-w-max items-center gap-4 px-4">
        <span className="flex items-center gap-1.5">
          <span className={`h-[5px] w-[5px] rounded-full ${dotClass}`} />
          <span>WS {label}</span>
        </span>
        {reconnectPaused && (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('maet:ws-reconnect'))
            }
            className="rounded border border-warn/40 px-1.5 py-0.5 text-warn hover:bg-warn/10"
            aria-label={`WebSocket reconnect paused after ${wsAttempts} attempts. Click to retry.`}
          >
            retry reconnect
          </button>
        )}
        <span>Feed: {tickCount.toLocaleString('en-IN')} ticks</span>
        <span>Broker: paper</span>
        <span>Engine: ready</span>
      </div>

      <div className="ml-auto flex min-w-max items-center gap-4 px-4">
        <span
          className={pnlIsLive ? (positive ? 'text-up' : 'text-dn') : 'text-text-muted'}
          aria-label={pnlAriaLabel}
        >
          {pnlIsLive ? 'P&L' : 'P&L (sim)'}{' '}
          {positive ? '+' : ''}
          {dayPnl.toLocaleString('en-IN', {
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
