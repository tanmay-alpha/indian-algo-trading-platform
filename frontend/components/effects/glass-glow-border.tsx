'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassGlowBorderProps {
  children: ReactNode
  className?: string
}

export function GlassGlowBorder({ children, className }: GlassGlowBorderProps) {
  return <div className={cn('glass-glow-border', className)}>{children}</div>
}
