'use client'

import { cn } from '@/lib/utils'

interface ConnectionStatusPillProps {
  label: string
  connected: boolean
  statusText?: string
  latencyMs?: number
  stale?: boolean
  className?: string
  detail?: string
}

export function ConnectionStatusPill({
  label,
  connected,
  statusText,
  latencyMs,
  stale = false,
  className,
  detail,
}: ConnectionStatusPillProps) {
  const displayStatus = statusText || (connected ? 'CONNECTED' : 'Connecting...')

  return (
    <div
      title={detail ? `${label}: ${displayStatus} — ${detail}` : `${label}: ${displayStatus}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 h-[22px] rounded-sm border border-border/80 bg-panel/30 text-xs font-mono uppercase tracking-wider',
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          connected && !stale ? 'bg-up live-dot' : stale ? 'bg-warn animate-pulse-soft' : 'bg-warn animate-pulse-soft'
        )}
      />
      <span className="text-text-faint">{label}</span>
      <span
        className={cn(
          'font-semibold',
          connected && !stale ? 'text-up' : 'text-warn'
        )}
      >
        {displayStatus}
      </span>
      {latencyMs !== undefined && connected && (
        <span className="text-text-faint font-normal tabular-nums ml-0.5">
          ({latencyMs}ms)
        </span>
      )}
    </div>
  )
}
