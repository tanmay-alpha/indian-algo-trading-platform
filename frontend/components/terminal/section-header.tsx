'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  badge?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'h-8 px-3 shrink-0 flex items-center justify-between border-b border-border bg-panel-2/30 select-none',
        className
      )}
    >
      <div className="flex items-center gap-2 overflow-hidden mr-2">
        <span className="text-[10px] font-mono font-semibold text-text uppercase tracking-wider truncate">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] font-mono text-text-faint truncate hidden xs:inline-block">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {action}
      </div>
    </div>
  )
}
