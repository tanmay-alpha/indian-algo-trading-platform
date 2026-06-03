'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AnimatedBorder({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('maet-premium-border overflow-hidden', className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px -translate-x-full bg-gradient-to-r from-transparent via-maet-cyan to-transparent motion-safe:animate-[borderSweep_4s_linear_infinite]"
      />
      {children}
    </div>
  )
}
