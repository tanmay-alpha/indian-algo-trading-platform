'use client'

import { cn } from '@/lib/utils'

interface AmbientGradientProps {
  className?: string
  color?: 'cyan' | 'purple' | 'blue' | 'emerald' | 'amber' | 'rose'
}

export function AmbientGradient({ className, color = 'cyan' }: AmbientGradientProps) {
  const gradients = {
    cyan: 'from-cyan-500/10 via-blue-500/5 to-transparent',
    purple: 'from-purple-500/10 via-fuchsia-500/5 to-transparent',
    blue: 'from-blue-500/10 via-indigo-500/5 to-transparent',
    emerald: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    amber: 'from-amber-500/10 via-yellow-500/5 to-transparent',
    rose: 'from-rose-500/10 via-pink-500/5 to-transparent',
  }

  return (
    <div
      className={cn(
        'absolute inset-0 bg-gradient-to-b opacity-70 blur-[100px] pointer-events-none -z-10 transition-all duration-700',
        gradients[color],
        className
      )}
    />
  )
}
