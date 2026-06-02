'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppCardProps {
  children: ReactNode
  className?: string
}

export function AppCard({ children, className }: AppCardProps) {
  return (
    <div className={cn('reflection-card', className)}>
      {children}
    </div>
  )
}
