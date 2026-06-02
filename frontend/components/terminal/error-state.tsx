'use client'

import { AlertOctagon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  compact?: boolean
  className?: string
}

export function ErrorState({
  title = 'API connection error',
  message,
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center font-mono border border-down/20 bg-down-dim/5 rounded-sm',
        compact ? 'p-3 gap-1.5' : 'p-6 gap-3 min-h-[160px]',
        className
      )}
    >
      <AlertOctagon className={cn('text-down', compact ? 'w-4 h-4' : 'w-6 h-6')} />
      
      <div className="flex flex-col gap-0.5">
        <span className={cn(
          'uppercase tracking-wider text-down font-semibold',
          compact ? 'text-[10px]' : 'text-2xs'
        )}>
          {title}
        </span>
        <span className="text-[10px] text-text-dim max-w-xs leading-relaxed">
          {message}
        </span>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-down/30 bg-bg text-[10px] text-down hover:bg-down/10 hover:border-down transition-colors active:scale-95 duration-100"
        >
          <RefreshCw className="w-3 h-3" />
          <span>RETRY</span>
        </button>
      )}
    </div>
  )
}
