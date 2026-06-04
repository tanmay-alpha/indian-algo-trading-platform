'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AnimatedBorder({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('maet-premium-border overflow-hidden', className)}>
      {children}
    </div>
  )
}
