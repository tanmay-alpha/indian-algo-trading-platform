'use client'

import { cn, marketSessionLabel, uiStatusMeta } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'

interface PillProps {
  label: string
  status: string
  detail?: string
  value?: string
}

function StatusPill({ label, status, detail, value }: PillProps) {
  const meta = uiStatusMeta(status)
  return (
    <div
      title={detail ? `${label}: ${status} — ${detail}` : `${label}: ${status}`}
      className="flex h-full shrink-0 items-center gap-1 border-r border-border/60 px-2"
    >
      <span className="font-mono text-[9px] text-text-faint">{label}</span>
      <span className={cn('h-[5px] w-[5px] shrink-0 rounded-full', meta.dotClass)} />
      <span className={cn('shrink-0 font-mono text-[9px] font-medium', meta.textClass)}>
        {value ?? meta.shortLabel}
      </span>
    </div>
  )
}

export function OperatorStatusStrip() {
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const mode = useTerminalStore((s) => s.executionMode)

  const session = marketSessionLabel()
  const stale = lastTickAt != null && Date.now() - lastTickAt > 12_000

  const apiLabel = apiStatus === 'UNKNOWN'
    ? backendWakeState === 'WAKING' ? 'WAKING' : 'CONNECTING'
    : apiStatus

  const brkStatus = broker?.logged_in ? 'ONLINE' : broker?.last_error ? 'ERROR' : apiLabel
  const feedStatus = session !== 'LIVE' ? session : broker?.feed_token_available ? 'LIVE' : 'WAITING'
  const wsLabel = wsStatus === 'CONNECTED' ? 'ONLINE' : wsStatus === 'RECONNECTING' ? 'RECONN' : wsStatus
  const tickStatus = lastTickAt ? (stale ? 'STALE' : 'LIVE') : session === 'LIVE' ? 'WAITING' : 'CLOSED'

  return (
    <div className="flex h-full items-stretch overflow-x-auto" role="status" aria-label="System status">
      <StatusPill label="BRK" status={brkStatus} detail={broker?.last_error ?? undefined} />
      <StatusPill label="FEED" status={feedStatus} detail={broker?.feed_token_available ? 'feed token ok' : 'no token'} />
      <StatusPill label="WS" status={wsLabel} />
      <StatusPill label="TICK" status={tickStatus} value={lastTickAt ? (stale ? 'STALE' : 'LIVE') : '—'} />
      <StatusPill
        label="CDL"
        status={status?.candles ? 'READY' : apiLabel}
        detail={status?.candles?.symbols ? `${status.candles.symbols.length} sym` : undefined}
      />
      <StatusPill label="LOCK" status={mode === 'PAPER' ? 'LOCKED' : 'LIVE'} detail="Live execution disabled" />
      <StatusPill label="API" status={apiLabel} />
    </div>
  )
}
