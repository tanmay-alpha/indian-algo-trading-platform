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
  const display = quality === 'BACKEND OFFLINE' ? 'API OFFLINE' : quality
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
            quality === 'WAITING' && 'bg-text-faint',
            quality === 'READY' && 'bg-up',
            quality === 'WARMING' && 'bg-info animate-pulse-soft',
            quality === 'UNAVAILABLE' && 'bg-text-faint',
            quality === 'BACKEND OFFLINE' && 'bg-down',
            quality === 'MOCK' && 'bg-info',
            quality === 'LOADING' && 'bg-info animate-pulse-soft',
            quality === 'ERROR' && 'bg-down',
            (quality === 'MARKET CLOSED' ||
              quality === 'PRE-MARKET' ||
              quality === 'POST-MARKET') &&
              'bg-warn'
          )}
        />
      )}
      {display}
    </span>
  )
}
