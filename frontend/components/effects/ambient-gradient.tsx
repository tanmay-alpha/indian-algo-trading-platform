'use client'

import { cn } from '@/lib/utils'

interface AmbientGradientProps {
  className?: string
  color?: 'cyan' | 'purple' | 'blue' | 'emerald' | 'amber' | 'rose'
}

export function AmbientGradient({ className, color = 'cyan' }: AmbientGradientProps) {
  return (
    <div
      data-color={color}
      className={cn('absolute inset-0 pointer-events-none -z-10 transition-all duration-700', className)}
    />
  )
}
