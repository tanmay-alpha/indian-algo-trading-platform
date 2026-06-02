'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChartFrameProps {
  children: ReactNode
  className?: string
}

export function ChartFrame({ children, className }: ChartFrameProps) {
  return (
    <div className={cn('glass-glow-border min-h-[320px] overflow-hidden rounded-card border border-maet-glass-border bg-maet-bg-deep/72 shadow-inner backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}
