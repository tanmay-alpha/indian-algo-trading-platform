'use client'

import { cn } from '@/lib/utils'

interface LivePulseDotProps {
  className?: string
  color?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple'
  size?: 'sm' | 'md' | 'lg'
}

export function LivePulseDot({
  className,
  color = 'emerald',
  size = 'md',
}: LivePulseDotProps) {
  const colorMap = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  }

  const ringColorMap = {
    emerald: 'bg-emerald-500/50',
    amber: 'bg-amber-500/50',
    rose: 'bg-rose-500/50',
    blue: 'bg-blue-500/50',
    purple: 'bg-purple-500/50',
  }

  const sizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  }

  return (
    <span className={cn('relative flex items-center justify-center', sizeMap[size], className)}>
      <span className={cn('absolute inline-flex h-full w-full rounded-full animate-ping opacity-75', ringColorMap[color])} />
      <span className={cn('relative inline-flex rounded-full', sizeMap[size], colorMap[color])} />
    </span>
  )
}
