'use client'

import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  as?: ElementType
  glow?: boolean
  strength?: 'default' | 'strong'
}

export function GlassPanel({
  children,
  className,
  as: Component = 'div',
  glow = false,
  strength = 'default',
}: GlassPanelProps) {
  const panelClass = strength === 'strong' ? 'glass-panel-strong' : 'glass-panel'

  return (
    <Component className={cn(glow ? `${panelClass} glass-glow-border` : panelClass, className)}>
      {children}
    </Component>
  )
}
