'use client'

import { cn } from '@/lib/utils'

interface LiquidOrbProps {
  className?: string
  tone?: 'cyan' | 'blue' | 'violet' | 'green' | 'amber'
}

export function LiquidOrb({ className, tone = 'cyan' }: LiquidOrbProps) {
  const toneClass = {
    cyan: 'opacity-60',
    blue: 'hue-rotate-15 opacity-55',
    violet: 'hue-rotate-60 opacity-45',
    green: '-hue-rotate-60 opacity-45',
    amber: '-hue-rotate-180 opacity-40',
  }[tone]

  return <span aria-hidden="true" className={cn('liquid-orb', toneClass, className)} />
}
