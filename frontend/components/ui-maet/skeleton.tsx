'use client'

import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-maet-elevated', className)}>
      <div className="absolute inset-y-0 w-full bg-maet-glass-bg-strong" />
    </div>
  )
}
