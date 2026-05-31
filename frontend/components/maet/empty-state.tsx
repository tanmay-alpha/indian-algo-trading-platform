'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Props {
  title: string
  hint?: string
  variant?: 'default' | 'warn' | 'error' | 'info'
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
  compact,
  className,
  action,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center font-mono',
        compact ? 'p-3 gap-1.5' : 'p-6 gap-2',
        className
      )}
    >
      {icon && <div className="text-text-faint">{icon}</div>}
      <div
        className={cn(
          'uppercase tracking-wider font-semibold',
          compact ? 'text-xs' : 'text-sm',
          variant === 'warn' && 'text-warn',
          variant === 'error' && 'text-down',
          variant === 'info' && 'text-info',
          variant === 'default' && 'text-text-2'
        )}
      >
        {title}
      </div>
      {hint && (
        <div className="text-xs text-text-dim max-w-sm leading-relaxed">
          {hint}
        </div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
