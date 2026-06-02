'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-white/[0.06]', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-info/20 bg-info/10 text-info">
            {icon}
          </span>
        )}
        <h2 className="truncate text-sm font-extrabold text-text">{title}</h2>
      </div>
      {action}
    </div>
  )
}
