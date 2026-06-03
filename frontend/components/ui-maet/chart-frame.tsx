'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChartFrameProps {
  children: ReactNode
  className?: string
}

export function ChartFrame({ children, className }: ChartFrameProps) {
  return (
    <div className={cn('maet-premium-border min-h-[300px] overflow-hidden rounded-lg border border-maet-glass-border bg-maet-ink-950/72 shadow-inner backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}
