'use client'

import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ReflectionCardProps {
  children: ReactNode
  className?: string
  as?: ElementType
}

export function ReflectionCard({ children, className, as: Component = 'div' }: ReflectionCardProps) {
  return <Component className={cn('reflection-card', className)}>{children}</Component>
}
