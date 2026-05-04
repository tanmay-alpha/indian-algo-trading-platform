'use client'

import type { DataQuality, IndexSnapshot } from '@/lib/types'
import { cn, fmtPct, fmtPrice, marketSessionLabel, priceDirClass } from '@/lib/utils'
import { DataQualityBadge } from './data-quality-badge'

interface Props {
  label: string
  snapshot?: IndexSnapshot | null
  className?: string
}

export function IndexTicker({ label, snapshot, className }: Props) {
  const hasData = snapshot?.ltp != null
  const change = snapshot?.change ?? null
  const changePct = snapshot?.change_pct ?? null
  const session = marketSessionLabel()
  const quality: DataQuality =
    snapshot?.quality ??
    (snapshot?.status === 'unavailable'
      ? session === 'LIVE'
        ? 'UNAVAILABLE'
        : session
      : hasData
      ? 'LIVE'
      : session === 'LIVE'
      ? 'UNAVAILABLE'
      : session)

  return (
    <div
      className={cn(
        'min-w-[142px] flex items-center gap-2 px-2.5 h-8 rounded-md border border-border bg-panel/70 hover:border-border-strong transition-colors shrink-0',
        className
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wide text-text-2">
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
          'w-12 text-right text-2xs font-mono tnum',
          hasData ? priceDirClass(change) : 'text-text-faint'
        )}
      >
        {hasData ? fmtPct(changePct) : '—'}
      </span>
      <DataQualityBadge quality={quality} showDot={false} />
    </div>
  )
}
