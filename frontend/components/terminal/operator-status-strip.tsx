'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { cn, marketSessionLabel, uiStatusMeta } from '@/lib/utils'

type DotStatus = string

export function OperatorStatusStrip() {
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const mode = useTerminalStore((s) => s.executionMode)

  const tickBus = status?.tick_bus
  const stale = lastTickAt != null && Date.now() - lastTickAt > 12_000
  const session = marketSessionLabel()
  const apiLabel = apiStatus === 'UNKNOWN'
    ? backendWakeState === 'WAKING'
      ? 'WAKING'
      : 'CONNECTING'
    : apiStatus
  const feedLabel = session !== 'LIVE'
    ? session
    : broker?.feed_token_available
    ? 'LIVE'
    : broker
    ? 'WAITING'
    : apiLabel
  const tickLabel = lastTickAt
    ? stale
      ? 'STALE'
      : 'LIVE'
    : session === 'LIVE'
    ? apiStatus === 'ONLINE'
      ? 'WAITING'
      : apiLabel
    : session

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto" role="status">
      <StatusDot
        label="BRK"
        status={broker?.logged_in ? 'ONLINE' : broker?.last_error ? 'STALE' : apiStatus === 'ONLINE' ? 'WAITING' : apiLabel}
        detail={broker?.last_error ?? undefined}
      />
      <StatusDot
        label="FEED"
        status={feedLabel}
        detail={broker?.feed_token_available ? 'feed token present' : 'no feed token'}
      />
      <StatusDot
        label="WS"
        status={wsStatus === 'CONNECTED' ? 'ONLINE' : wsStatus}
        detail={wsStatus}
      />
      <StatusDot label="EVT" status={status?.event_bus ? 'ONLINE' : apiStatus === 'ONLINE' ? 'WAITING' : apiLabel} />
      <StatusDot
        label="TICK"
        status={(tickBus?.drop_rate_pct ?? 0) > 5 ? 'STALE' : tickLabel}
        detail={tickBus?.drop_rate_pct != null ? `drop ${tickBus.drop_rate_pct.toFixed(2)}%` : undefined}
      />
      <StatusDot
        label="CDL"
        status={status?.candles ? 'READY' : apiStatus === 'ONLINE' ? 'WAITING' : apiLabel}
        detail={status?.candles?.symbols ? `${status.candles.symbols.length} symbol(s)` : undefined}
      />
      <StatusDot
        label="LOCK"
        status={mode === 'PAPER' ? 'LOCKED' : 'STALE'}
        detail={mode === 'PAPER' ? 'Live execution disabled' : 'Live mode (execution gated)'}
      />
      <StatusDot label="API" status={apiLabel} />
    </div>
  )
}

function StatusDot({
  label,
  status,
  detail,
}: {
  label: string
  status: DotStatus
  detail?: string
}) {
  const meta = uiStatusMeta(status)
  return (
    <span
      title={detail ? `${label}: ${status} - ${detail}` : `${label}: ${status}`}
      className="inline-flex h-[22px] min-w-fit items-center gap-1.5 rounded-sm border border-border bg-panel/60 px-1.5 text-[10px] font-mono text-text-2"
    >
      <span className="text-text-faint">{label}</span>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          meta.dotClass
        )}
      />
      <span className="text-text">{meta.shortLabel}</span>
    </span>
  )
}
