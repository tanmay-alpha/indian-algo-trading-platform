'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { ConnectionBadge } from './connection-badge'
import type { OperatorState } from '@/lib/types'

export function OperatorStatusStrip() {
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const backendOffline = useTerminalStore((s) => s.backendOffline)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const mode = useTerminalStore((s) => s.executionMode)

  const brokerState: OperatorState = backendOffline
    ? 'BACKEND OFFLINE'
    : !broker
    ? 'UNAVAILABLE'
    : broker.last_error
    ? 'DEGRADED'
    : broker.logged_in
    ? 'ONLINE'
    : 'OFFLINE'

  const feedState: OperatorState = backendOffline
    ? 'BACKEND OFFLINE'
    : !broker
    ? 'UNAVAILABLE'
    : broker.feed_token_available
    ? 'ONLINE'
    : 'OFFLINE'

  const wsState: OperatorState = backendOffline
    ? 'BACKEND OFFLINE'
    : wsConnected
    ? 'ONLINE'
    : 'OFFLINE'

  const eventBusState: OperatorState = backendOffline
    ? 'BACKEND OFFLINE'
    : status?.event_bus
    ? 'ONLINE'
    : 'UNAVAILABLE'

  const tickBus = status?.tick_bus
  const tickBusState: OperatorState = backendOffline
    ? 'BACKEND OFFLINE'
    : !tickBus
    ? 'UNAVAILABLE'
    : (tickBus.drop_rate_pct ?? 0) > 5
    ? 'DEGRADED'
    : 'ONLINE'

  const candleState: OperatorState = backendOffline
    ? 'BACKEND OFFLINE'
    : status?.candles
    ? 'ONLINE'
    : 'UNAVAILABLE'

  const lockState: OperatorState = mode === 'PAPER' ? 'LOCKED' : 'ONLINE'

  const apiState: OperatorState = backendOffline ? 'OFFLINE' : 'ONLINE'

  // Stale flag if last tick is too old
  const stale = lastTickAt != null && Date.now() - lastTickAt > 12_000

  const tickDetailParts: string[] = []
  if (tickBus) {
    if (tickBus.total != null) tickDetailParts.push(`total ${tickBus.total}`)
    if (tickBus.drop_rate_pct != null)
      tickDetailParts.push(`drop ${tickBus.drop_rate_pct.toFixed(2)}%`)
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" role="status">
      <ConnectionBadge
        label="BRK"
        state={brokerState}
        detail={broker?.last_error ?? undefined}
      />
      <ConnectionBadge
        label="FEED"
        state={feedState}
        detail={broker?.feed_token_available ? 'feed token present' : 'no feed token'}
      />
      <ConnectionBadge
        label="WS"
        state={stale && wsConnected ? 'STALE' : wsState}
        detail={
          lastTickAt
            ? `last tick ${Math.round((Date.now() - lastTickAt) / 1000)}s ago`
            : undefined
        }
      />
      <ConnectionBadge label="EVT" state={eventBusState} />
      <ConnectionBadge
        label="TICK"
        state={tickBusState}
        detail={tickDetailParts.join(' · ') || undefined}
      />
      <ConnectionBadge
        label="CDL"
        state={candleState}
        detail={
          status?.candles?.symbols != null
            ? `${status.candles.symbols} symbol(s)`
            : undefined
        }
      />
      <ConnectionBadge
        label="LOCK"
        state={lockState}
        detail={
          mode === 'PAPER'
            ? 'Live execution disabled'
            : 'Live mode (execution gated)'
        }
      />
      <ConnectionBadge label="API" state={apiState} />
    </div>
  )
}
