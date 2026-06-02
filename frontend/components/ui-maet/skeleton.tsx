'use client'

import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-maet-elevated', className)}>
      <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" style={{ animation: 'shimmer 1.4s infinite' }} />
    </div>
  )
}
