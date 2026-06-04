'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('maet-card maet-card-hover overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-maet-cyan/80" />
      <div className="relative">{children}</div>
    </div>
  )
}
