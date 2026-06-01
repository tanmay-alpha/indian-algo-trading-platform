'use client'

import { cn } from '@/lib/utils'

interface FloatingOrbProps {
  className?: string
  color?: string // Tailwind bg class or hex
  delay?: number // animation delay in seconds
  duration?: number // duration in seconds
  size?: string // Tailwind size class (e.g., w-72 h-72)
}

export function FloatingOrb({
  className,
  color = 'bg-cyan-500/10',
  delay = 0,
  duration = 15,
  size = 'w-72 h-72',
}: FloatingOrbProps) {
  return (
    <div
      className={cn(
        'absolute rounded-full blur-3xl pointer-events-none -z-20 animate-pulse',
        color,
        size,
        className
      )}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      }}
    />
  )
}
