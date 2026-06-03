'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
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
        'flex flex-col items-center justify-center text-center border border-[#EA3943]/20 bg-[#EA3943]/5 rounded-2xl',
        compact ? 'p-4 gap-2' : 'p-6 gap-3 min-h-[160px]',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-[#EA3943]/10 flex items-center justify-center text-[#EA3943] shrink-0 border border-[#EA3943]/20">
        <AlertTriangle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      </div>
      
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#EA3943]">
          {title}
        </span>
        <span className="text-xs text-text-dim max-w-xs leading-normal font-medium">
          {message}
        </span>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EA3943]/30 bg-black/40 text-xs font-bold text-[#EA3943] hover:bg-[#EA3943]/15 transition-all duration-150 active:scale-[0.97]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>RETRY</span>
        </button>
      )}
    </div>
  )
}
