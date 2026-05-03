'use client'

import type { DataQuality } from '@/lib/types'
import { cn, qualityClass } from '@/lib/utils'

interface Props {
  quality: DataQuality
  size?: 'xs' | 'sm'
  className?: string
  showDot?: boolean
}

export function DataQualityBadge({
  quality,
  size = 'xs',
  className,
  showDot = true,
}: Props) {
  const display = quality === 'UNAVAILABLE' ? 'Waiting' : quality
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 rounded-sm border font-mono uppercase tracking-wider whitespace-nowrap',
        size === 'xs' ? 'text-[9px] leading-[14px] py-px' : 'text-2xs py-0.5',
        qualityClass(quality),
        quality === 'LIVE' && 'live-dot',
        className
      )}
      title={quality}
    >
      {showDot && (
        <span
          className={cn(
            'w-1 h-1 rounded-full',
            quality === 'LIVE' && 'bg-up shadow-[0_0_4px_rgba(22,199,132,0.7)]',
            quality === 'STALE' && 'bg-warn',
            quality === 'DELAYED' && 'bg-warn',
            quality === 'UNAVAILABLE' && 'bg-text-faint',
            quality === 'BACKEND OFFLINE' && 'bg-down',
            quality === 'MOCK' && 'bg-info',
            quality === 'LOADING' && 'bg-info animate-pulse-soft',
            quality === 'ERROR' && 'bg-down'
          )}
        />
      )}
      {display}
    </span>
  )
}
