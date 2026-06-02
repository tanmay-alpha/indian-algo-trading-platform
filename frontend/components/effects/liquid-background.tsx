'use client'

import { cn } from '@/lib/utils'

interface LiquidBackgroundProps {
  className?: string
  intensity?: 'calm' | 'standard' | 'strong'
}

export function LiquidBackground({ className, intensity = 'standard' }: LiquidBackgroundProps) {
  const opacity = {
    calm: 'opacity-55',
    standard: 'opacity-75',
    strong: 'opacity-95',
  }[intensity]

  return (
    <div aria-hidden="true" className={cn('liquid-background', opacity, className)} />
  )
}
