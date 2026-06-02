'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassDockProps {
  children: ReactNode
  className?: string
}

export function GlassDock({ children, className }: GlassDockProps) {
  return <div className={cn('glass-dock', className)}>{children}</div>
}
