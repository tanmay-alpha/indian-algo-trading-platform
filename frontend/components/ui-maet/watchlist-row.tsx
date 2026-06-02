'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart2, GripVertical, MinusCircle, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from './status-badge'

interface WatchlistRowProps {
  symbol: string
  name?: string
  exchange?: string
  price?: number | null
  changePct?: number | null
  offline?: boolean
  selected?: boolean
  onOpen?: () => void
  onRemove?: () => void
}

export function WatchlistRow({
  symbol,
  name,
  exchange = 'NSE',
  price,
  changePct,
  offline = false,
  selected = false,
  onOpen,
  onRemove,
}: WatchlistRowProps) {
  const previousPriceRef = useRef<number | null>(price ?? null)
  const [flash, setFlash] = useState<'tick-up' | 'tick-down' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    const previous = previousPriceRef.current
    if (previous != null && price != null && price !== previous) {
      setFlash(price > previous ? 'tick-up' : 'tick-down')
      const timer = window.setTimeout(() => setFlash(null), 650)
      previousPriceRef.current = price
      return () => window.clearTimeout(timer)
    }
    previousPriceRef.current = price ?? null
    return undefined
  }, [price])

  const hasPrice = price != null && !offline
  const hasChange = changePct != null && !offline
  const isUp = (changePct ?? 0) >= 0
  const cleanSymbol = symbol.split(':').pop()?.replace(/-EQ$/, '') ?? symbol

  return (
    <div
      className="relative overflow-hidden rounded-card"
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        const start = touchX.current
        const end = event.changedTouches[0]?.clientX ?? null
        if (start != null && end != null && start - end > 38) setRevealed(true)
        if (start != null && end != null && end - start > 24) setRevealed(false)
        touchX.current = null
      }}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${cleanSymbol} from watchlist`}
          className="absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1 bg-maet-red/18 font-mono text-[11px] font-bold text-maet-red"
        >
          <MinusCircle className="h-3.5 w-3.5" />
          Remove
        </button>
      )}

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open chart for ${cleanSymbol}`}
        className={cn(
          'wl-row relative z-10 grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border bg-maet-surface px-3 text-left transition-transform',
          selected ? 'selected border-maet-blue/40' : 'border-maet-border hover:border-maet-border-strong hover:bg-maet-elevated',
          revealed && onRemove ? '-translate-x-24' : 'translate-x-0',
          flash
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="hidden h-4 w-4 shrink-0 text-maet-text-muted sm:block" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono text-sm font-extrabold text-maet-text">{cleanSymbol}</span>
              <span className="shrink-0 rounded border border-maet-border bg-maet-elevated px-1.5 py-0.5 font-mono text-[10px] font-bold text-maet-text-secondary">
                {exchange}
              </span>
            </div>
            <div className="mt-0.5 truncate text-xs text-maet-text-muted">{name || 'Awaiting instrument name'}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasPrice ? (
            <div className="text-right">
              <div className={cn('font-mono text-base font-extrabold tabular-nums', isUp ? 'text-maet-green' : 'text-maet-red')}>
                {price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {hasChange && (
                <div className={cn('mt-0.5 inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] font-bold', isUp ? 'bg-maet-green/12 text-maet-green' : 'bg-maet-red/12 text-maet-red')}>
                  {isUp ? '+' : ''}{changePct.toFixed(2)}%
                </div>
              )}
            </div>
          ) : (
            <StatusBadge tone={offline ? 'warning' : 'muted'} className="min-w-[84px] justify-center">
              {offline ? (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              ) : (
                'Awaiting'
              )}
            </StatusBadge>
          )}
          <BarChart2 className="hidden h-4 w-4 text-maet-blue sm:block" />
        </div>
      </button>
    </div>
  )
}
