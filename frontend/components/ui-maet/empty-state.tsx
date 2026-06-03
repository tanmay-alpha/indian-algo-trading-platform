'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint?: string
  variant?:
    | 'default'
    | 'warn'
    | 'error'
    | 'info'
    | 'market-data-waiting'
    | 'no-symbol-selected'
    | 'no-candles-available'
    | 'protected-view'
    | 'read-only-snapshot'
    | 'advisory-unavailable'
    | 'system-check-needed'
  icon?: ReactNode
  compact?: boolean
  className?: string
  action?: ReactNode
}

export function EmptyState({
  title,
  hint,
  variant = 'default',
  icon,
  compact = false,
  className,
  action,
}: EmptyStateProps) {
  const tone = variantTone(variant)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 rounded-2xl border p-4' : 'min-h-[160px] gap-3 rounded-2xl border p-8',
        tone.shell,
        className
      )}
    >
      {icon && (
        <div className={cn('mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border', tone.icon)}>
          {icon}
        </div>
      )}
      <div className={cn('text-sm font-bold', tone.title)}>
        {title}
      </div>
      {hint && (
        <p className="max-w-[280px] text-xs font-medium leading-5 text-text-faint">
          {hint}
        </p>
      )}
      {action && <div className="mt-2 shrink-0">{action}</div>}
    </div>
  )
}

function variantTone(variant: NonNullable<EmptyStateProps['variant']>) {
  if (variant === 'warn' || variant === 'protected-view' || variant === 'system-check-needed') {
    return {
      shell: 'border-maet-amber/18 bg-maet-amber/5',
      icon: 'border-maet-amber/20 bg-maet-amber/10 text-maet-amber',
      title: 'text-maet-text',
    }
  }

  if (variant === 'error') {
    return {
      shell: 'border-maet-red/18 bg-maet-red/5',
      icon: 'border-maet-red/20 bg-maet-red/10 text-maet-red',
      title: 'text-maet-text',
    }
  }

  if (variant === 'info' || variant === 'market-data-waiting' || variant === 'no-symbol-selected' || variant === 'no-candles-available') {
    return {
      shell: 'border-maet-cyan/16 bg-maet-cyan/5',
      icon: 'border-maet-cyan/20 bg-maet-cyan/10 text-maet-cyan',
      title: 'text-maet-text',
    }
  }

  if (variant === 'advisory-unavailable') {
    return {
      shell: 'border-maet-violet/16 bg-maet-violet/5',
      icon: 'border-maet-violet/20 bg-maet-violet/10 text-maet-violet',
      title: 'text-maet-text',
    }
  }

  return {
    shell: 'border-white/[0.06] bg-white/[0.018]',
    icon: 'border-white/[0.06] bg-white/[0.03] text-text-dim',
    title: 'text-text',
  }
}
