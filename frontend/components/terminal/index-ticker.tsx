'use client'

import { cn, fmtPrice, fmtPct, priceDirClass } from '@/lib/utils'
import type { IndexSnapshot, DataQuality } from '@/lib/types'
import { DataQualityBadge } from './data-quality-badge'

interface Props {
  label: string
  snapshot?: IndexSnapshot | null
  className?: string
}

export function IndexTicker({ label, snapshot, className }: Props) {
  const hasData = snapshot && snapshot.ltp != null
  const change = snapshot?.change ?? null
  const changePct = snapshot?.change_pct ?? null
  const quality: DataQuality =
    snapshot?.quality ??
    (snapshot?.status === 'unavailable'
      ? 'UNAVAILABLE'
      : hasData
      ? 'LIVE'
      : 'UNAVAILABLE')

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 h-8 rounded-sm border border-border bg-panel/60 hover:border-border-strong transition-colors shrink-0',
        className
      )}
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-text-2">
        {label}
      </span>
      <span
        className={cn(
          'text-xs font-mono tnum',
          hasData ? 'text-text' : 'text-text-faint'
        )}
      >
        {hasData ? fmtPrice(snapshot!.ltp, 2) : '—'}
      </span>
      <span
        className={cn(
          'text-2xs font-mono tnum',
          hasData ? priceDirClass(change) : 'text-text-faint'
        )}
      >
        {hasData ? fmtPct(changePct) : '—'}
      </span>
      <DataQualityBadge quality={quality} />
    </div>
  )
}
