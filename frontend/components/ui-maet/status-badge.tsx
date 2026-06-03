'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'locked' | 'paper' | 'read' | 'ai' | 'success' | 'danger' | 'warning' | 'info' | 'muted'

const toneClass: Record<BadgeTone, string> = {
  locked: 'border-safety-locked/70 bg-safety-locked/20 text-safety-locked',
  paper: 'border-safety-paper/70 bg-safety-paper/20 text-safety-paper',
  read: 'border-safety-read/70 bg-safety-read/20 text-safety-read',
  ai: 'border-maet-violet/70 bg-maet-violet/20 text-maet-violet',
  success: 'border-maet-green/60 bg-maet-green/10 text-maet-green',
  danger: 'border-maet-red/60 bg-maet-red/10 text-maet-red',
  warning: 'border-maet-amber/60 bg-maet-amber/10 text-maet-amber',
  info: 'border-maet-blue/60 bg-maet-blue/10 text-maet-blue',
  muted: 'border-maet-border bg-maet-elevated/60 text-maet-text-secondary',
}

export function StatusBadge({
  children,
  tone = 'muted',
  dot = false,
  pulse = false,
  className,
  ariaLabel,
}: {
  children: ReactNode
  tone?: BadgeTone
  dot?: boolean
  pulse?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs font-bold uppercase',
        toneClass[tone],
        className
      )}
      aria-label={ariaLabel}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full bg-current', pulse && 'pulse-soft')} />}
      {children}
    </span>
  )
}
