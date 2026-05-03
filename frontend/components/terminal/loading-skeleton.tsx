'use client'

import { cn } from '@/lib/utils'

export function LoadingRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-7 px-3 flex items-center gap-2 border-b border-border/40"
        >
          <div className="h-2.5 w-12 bg-white/[0.04] rounded-sm animate-pulse-soft" />
          <div className="ml-auto h-2.5 w-14 bg-white/[0.04] rounded-sm animate-pulse-soft" />
        </div>
      ))}
    </div>
  )
}

export function LoadingCells({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-white/[0.03] border border-border rounded-sm animate-pulse-soft"
        />
      ))}
    </div>
  )
}
