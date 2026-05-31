'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface EmptyStateProps {
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
  compact = false,
  className,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'p-4 gap-2 border border-white/[0.04] bg-white/[0.01] rounded-2xl' : 'p-8 gap-3 border border-white/[0.05] bg-white/[0.015] rounded-2xl min-h-[160px]',
        className
      )}
    >
      {icon && (
        <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center text-text-dim mb-1 shrink-0 border border-white/[0.05]">
          {icon}
        </div>
      )}
      <div
        className={cn(
          'text-xs font-bold uppercase tracking-wider',
          variant === 'warn' && 'text-[#F59E0B]',
          variant === 'error' && 'text-[#EA3943]',
          variant === 'info' && 'text-[#22D3EE]',
          variant === 'default' && 'text-text-dim'
        )}
      >
        {title}
      </div>
      {hint && (
        <p className="text-2xs text-text-faint max-w-[240px] leading-normal font-medium">
          {hint}
        </p>
      )}
      {action && <div className="mt-2 shrink-0">{action}</div>}
    </div>
  )
}
