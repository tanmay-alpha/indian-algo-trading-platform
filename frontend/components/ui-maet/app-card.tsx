'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppCardProps {
  children: ReactNode
  className?: string
}

export function AppCard({ children, className }: AppCardProps) {
  return (
    <div className={cn('rounded-3xl border border-white/[0.08] bg-white/[0.045] shadow-card', className)}>
      {children}
    </div>
  )
}
