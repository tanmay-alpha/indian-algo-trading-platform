'use client'

import type { ConnectionState } from '@/lib/types'
import { cn, connectionStateClass, connectionStateDot } from '@/lib/utils'

interface Props {
  label: string
  state: ConnectionState
  detail?: string
  className?: string
}

export function ConnectionBadge({ label, state, detail, className }: Props) {
  return (
    <span
      title={detail ? `${label}: ${state} — ${detail}` : `${label}: ${state}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 h-[22px] rounded-sm border text-xs font-mono uppercase tracking-wider',
        connectionStateClass(state),
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', connectionStateDot(state))} />
      <span className="text-text-2">{label}</span>
      <span className="text-text">{state}</span>
    </span>
  )
}
