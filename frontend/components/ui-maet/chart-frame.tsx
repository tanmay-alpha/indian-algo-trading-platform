'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChartFrameProps {
  children: ReactNode
  className?: string
}

export function ChartFrame({ children, className }: ChartFrameProps) {
  return (
    <div className={cn('min-h-[320px] overflow-hidden rounded-card border border-maet-border bg-maet-void shadow-inner', className)}>
      {children}
    </div>
  )
}
