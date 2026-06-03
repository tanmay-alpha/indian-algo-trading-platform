'use client'

import { useEffect, useRef, useState } from 'react'
import { MinusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WatchlistRowProps {
  symbol: string
  name?: string
  exchange?: string
  price?: number | null
  changePct?: number | null
  volume?: number | null
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
  volume,
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
      className="group relative overflow-hidden rounded-card"
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
          className={cn(
            'absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1 bg-maet-red/20 font-mono text-xs font-bold text-maet-red transition-opacity',
            revealed ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
          )}
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
          'wl-row relative z-10 grid h-[62px] w-full grid-cols-[minmax(0,1fr)_minmax(84px,auto)] items-center gap-3 rounded-lg border bg-maet-panel-soft px-3 text-left transition-all sm:h-[56px]',
          selected ? 'selected border-maet-blue/50 bg-maet-blue/10 shadow-[inset_3px_0_0_rgba(47,128,255,0.9)]' : 'hover-glass',
          revealed && onRemove ? '-translate-x-24' : 'translate-x-0',
          flash
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-sm font-extrabold text-maet-text">{cleanSymbol}</span>
            <span className="shrink-0 rounded-md border border-white/10 bg-maet-glass-bg px-1.5 py-0.5 font-mono text-xs font-bold text-maet-text-soft">
              {exchange}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-maet-text-muted">{name || 'Instrument details pending'}</span>
            {volume != null && Number.isFinite(volume) && volume > 0 && (
              <span className="shrink-0 text-xs font-semibold text-maet-text-faint">{formatVolume(volume)}</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {hasPrice ? (
            <>
              <div className={cn('font-mono text-base font-extrabold tabular-nums', isUp ? 'text-maet-green' : 'text-maet-red')}>
                {price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {hasChange && (
                <div className={cn('mt-0.5 inline-flex rounded-md px-1.5 py-0.5 font-mono text-xs font-bold', isUp ? 'bg-maet-green/10 text-maet-green' : 'bg-maet-red/10 text-maet-red')}>
                  {isUp ? '+' : ''}{changePct.toFixed(2)}%
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-mono text-base font-extrabold text-maet-text-muted">--</div>
              <div className="mt-0.5 text-xs font-bold text-maet-text-faint"> </div>
            </>
          )}
        </div>
      </button>
    </div>
  )
}

function formatVolume(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return 'vol --'
  if (value >= 10000000) return `vol ${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `vol ${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `vol ${(value / 1000).toFixed(1)}K`
  return `vol ${value}`
}
