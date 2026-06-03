'use client'

import { cn } from '@/lib/utils'

interface LoadingStateProps {
  message?: string
  compact?: boolean
  className?: string
}

export function LoadingState({
  message = 'Loading Feed Data',
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'p-4 gap-2' : 'p-8 gap-3 min-h-[160px] border border-white/[0.05] bg-white/[0.015] rounded-2xl',
        className
      )}
    >
      <div className="relative flex items-center justify-center w-8 h-8">
        <div className="w-6 h-6 border-2 border-[#22D3EE]/20 rounded-full animate-ping absolute opacity-50" />
        <div className="w-5 h-5 border-2 border-t-[#22D3EE] border-r-transparent border-b-[#22D3EE] border-l-transparent rounded-full animate-spin" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#22D3EE]">
          {message}
        </span>
        <span className="text-xs text-text-faint tracking-wide font-medium">
          Securing safe connection...
        </span>
      </div>
    </div>
  )
}
