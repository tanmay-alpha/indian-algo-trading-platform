'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DataCardProps {
  title: string
  subtitle?: string
  badge?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  className?: string
  children: ReactNode
}

export function DataCard({
  title,
  subtitle,
  badge,
  action,
  footer,
  className,
  children,
}: DataCardProps) {
  return (
    <div
      className={cn(
        'rounded-sm border border-border bg-panel-2/50 backdrop-blur-md overflow-hidden flex flex-col transition-all duration-150 hover:border-[#38bdf8]/30',
        className
      )}
    >
      {/* Header */}
      <div className="h-9 px-3 shrink-0 flex items-center justify-between border-b border-border bg-bg/40 select-none">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <span className="text-xs font-semibold text-text truncate uppercase tracking-wide">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] font-mono text-text-dim truncate hidden sm:inline-block">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {action}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 p-3 relative z-10 bg-gradient-to-b from-transparent to-white/[0.005]">
        {children}
      </div>

      {/* Footer (Optional) */}
      {footer && (
        <div className="h-8 px-3 shrink-0 flex items-center justify-between border-t border-border bg-bg/25 text-[10px] font-mono text-text-dim select-none">
          {footer}
        </div>
      )}
    </div>
  )
}
