'use client'

import { cn } from '@/lib/utils'

interface LoadingStateProps {
  message?: string
  compact?: boolean
  className?: string
}

export function LoadingState({
  message = 'LOADING TERMINAL DATA',
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center font-mono',
        compact ? 'p-4 gap-2' : 'p-8 gap-3 min-h-[160px]',
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        {/* Shimmer pulse rings */}
        <div className="w-6 h-6 border-2 border-info/30 rounded-full animate-ping absolute opacity-45" />
        <div className="w-5 h-5 border-2 border-info rounded-full animate-pulse-soft" />
      </div>
      <div className="flex flex-col gap-1">
        <span className={cn(
          'uppercase tracking-widest text-info font-medium',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {message}
        </span>
        <span className="text-xs text-text-faint animate-pulse-soft">
          ESTABLISHING CONTEXT...
        </span>
      </div>
    </div>
  )
}
