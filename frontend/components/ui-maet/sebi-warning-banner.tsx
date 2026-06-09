'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SebiWarningBannerProps {
  variant?: 'sticky' | 'inline'
}

export function SebiWarningBanner({ variant = 'sticky' }: SebiWarningBannerProps) {
  const isSticky = variant === 'sticky'
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border-b border-amber/20 bg-amber/10 px-3 py-1.5 text-xs font-semibold text-amber',
        isSticky && 'sticky top-0 z-[60]'
      )}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        PAPER TRADING ONLY — No Real Money Involved
      </span>
      <span className="hidden sm:inline">• Not SEBI Registered • Not Investment Advice</span>
    </div>
  )
}