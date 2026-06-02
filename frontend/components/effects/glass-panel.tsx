'use client'

import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  as?: ElementType
  glow?: boolean
}

export function GlassPanel({
  children,
  className,
  as: Component = 'div',
  glow = false,
}: GlassPanelProps) {
  return (
    <Component className={cn(glow ? 'glass-panel glass-glow-border' : 'glass-panel', className)}>
      {children}
    </Component>
  )
}
