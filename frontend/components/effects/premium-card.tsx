'use client'

import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PremiumCardProps {
  as?: ElementType
  children: ReactNode
  className?: string
  strong?: boolean
}

export function PremiumCard({ as: Component = 'div', children, className, strong = false }: PremiumCardProps) {
  return (
    <Component className={cn(strong ? 'maet-glass-strong' : 'maet-card', 'maet-card-hover', className)}>
      {children}
    </Component>
  )
}
