'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('maet-card maet-card-hover overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-maet-cyan/80 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_58%)]" />
      <div className="relative">{children}</div>
    </div>
  )
}
