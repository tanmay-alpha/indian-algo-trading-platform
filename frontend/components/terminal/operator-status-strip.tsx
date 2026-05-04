'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'

type DotStatus = 'ok' | 'warn' | 'bad' | 'unavailable' | 'locked'

export function OperatorStatusStrip() {
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const backendOffline = useTerminalStore((s) => s.backendOffline)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const mode = useTerminalStore((s) => s.executionMode)

  const tickBus = status?.tick_bus
  const stale = lastTickAt != null && Date.now() - lastTickAt > 12_000

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" role="status">
      <StatusDot
        label="BRK"
        status={
          backendOffline
            ? 'bad'
            : broker?.logged_in
            ? 'ok'
            : broker?.last_error
            ? 'warn'
            : 'unavailable'
        }
        detail={broker?.last_error ?? undefined}
      />
      <StatusDot
        label="FEED"
        status={backendOffline ? 'bad' : broker?.feed_token_available ? 'ok' : 'unavailable'}
        detail={broker?.feed_token_available ? 'feed token present' : 'no feed token'}
      />
      <StatusDot
        label="WS"
        status={
          backendOffline
            ? 'bad'
            : wsStatus === 'CONNECTED'
            ? stale
              ? 'warn'
              : 'ok'
            : wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING'
            ? 'warn'
            : 'bad'
        }
        detail={wsStatus}
      />
      <StatusDot label="EVT" status={backendOffline ? 'bad' : status?.event_bus ? 'ok' : 'unavailable'} />
      <StatusDot
        label="TICK"
        status={
          backendOffline
            ? 'bad'
            : !tickBus
            ? 'unavailable'
            : (tickBus.drop_rate_pct ?? 0) > 5
            ? 'warn'
            : 'ok'
        }
        detail={tickBus?.drop_rate_pct != null ? `drop ${tickBus.drop_rate_pct.toFixed(2)}%` : undefined}
      />
      <StatusDot
        label="CDL"
        status={backendOffline ? 'bad' : status?.candles ? 'ok' : 'unavailable'}
        detail={status?.candles?.symbols ? `${status.candles.symbols.length} symbol(s)` : undefined}
      />
      <StatusDot
        label="LOCK"
        status={mode === 'PAPER' ? 'locked' : 'warn'}
        detail={mode === 'PAPER' ? 'Live execution disabled' : 'Live mode (execution gated)'}
      />
      <StatusDot label="API" status={backendOffline ? 'bad' : 'ok'} />
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
  return (
    <span
      title={detail ? `${label}: ${detail}` : label}
      className="inline-flex h-[22px] items-center gap-1.5 rounded-sm border border-border bg-panel/60 px-1.5 text-[10px] font-mono text-text-2"
    >
      <span>{label}</span>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'ok' && 'bg-up shadow-[0_0_6px_rgba(22,199,132,0.6)]',
          status === 'warn' && 'bg-warn',
          status === 'bad' && 'bg-down',
          status === 'locked' && 'bg-locked',
          status === 'unavailable' && 'bg-text-faint'
        )}
      />
    </span>
  )
}
