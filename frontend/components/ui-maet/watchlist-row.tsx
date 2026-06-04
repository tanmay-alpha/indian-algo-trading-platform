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
  subscribed?: boolean
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
  subscribed,
  selected = false,
  onOpen,
  onRemove,
}: WatchlistRowProps) {
  const previousPriceRef = useRef<number | null>(price ?? null)
  const [flash, setFlash] = useState<'flash-up' | 'flash-down' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    const previous = previousPriceRef.current
    if (previous != null && price != null && price !== previous) {
      setFlash(price > previous ? 'flash-up' : 'flash-down')
      const timer = window.setTimeout(() => setFlash(null), 650)
      previousPriceRef.current = price
      return () => window.clearTimeout(timer)
    }
    previousPriceRef.current = price ?? null
    return undefined
  }, [price])

  const isSubscribed = subscribed ?? !offline
  const hasPrice = isSubscribed && price != null && !offline
  const hasChange = isSubscribed && changePct != null && !offline
  const isUp = (changePct ?? 0) >= 0
  const cleanSymbol = symbol.split(':').pop()?.replace(/-EQ$/, '') ?? symbol
  const displayName = displayInstrumentName(cleanSymbol, name, exchange)
  const dotClass = hasPrice
    ? 'bg-up animate-pulse-soft'
    : isSubscribed
    ? 'bg-warn'
    : 'bg-text-faint'
  const ltpClass = hasPrice
    ? changePct == null
      ? 'text-[var(--text-1)]'
      : changePct < 0
      ? 'price-down'
      : 'price-up'
    : 'text-[var(--text-3)]'

  return (
    <div
      className="group relative overflow-hidden rounded-sm"
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
          'wl-row relative z-10 grid h-8 w-full grid-cols-[minmax(0,1fr)_68px_48px_36px] items-center gap-2 rounded-sm border border-border/60 bg-[var(--bg-card)] px-2 text-left transition-all',
          selected && 'selected border-l-2 border-l-[var(--neutral)] bg-[var(--neutral-dim)]',
          revealed && onRemove ? '-translate-x-24' : 'translate-x-0',
          flash
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />
          <span className="shrink-0 font-mono text-[11px] font-semibold leading-none text-[var(--text-1)]">{cleanSymbol}</span>
          <span className="max-w-[120px] truncate text-[10px] leading-none text-[var(--text-3)]">{displayName}</span>
          {!isSubscribed && (
            <span className="shrink-0 rounded-sm border border-border px-1 font-mono text-[9px] font-semibold leading-4 text-[var(--text-3)]">
              NO FEED
            </span>
          )}
        </div>

        <span className={cn('w-[68px] text-right font-mono text-[13px] font-semibold leading-none tabular-nums', ltpClass)}>
          {hasPrice ? price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </span>
        <span className={cn('w-[48px] text-right font-mono text-[10px] leading-none tabular-nums', hasChange ? (isUp ? 'price-up' : 'price-down') : 'text-[var(--text-3)]')}>
          {hasChange ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
        </span>
        <span className="w-[36px] text-right font-mono text-[10px] leading-none tabular-nums text-[var(--text-3)]">
          {hasPrice && volume != null && Number.isFinite(volume) && volume > 0 ? formatVolume(volume) : '—'}
        </span>
      </button>
    </div>
  )
}

const DEFAULT_INSTRUMENT_NAMES: Record<string, string> = {
  AXISBANK: 'Axis Bank',
  BAJFINANCE: 'Bajaj Finance',
  BHARTIARTL: 'Bharti Airtel',
  HDFCBANK: 'HDFC Bank',
  ICICIBANK: 'ICICI Bank',
  INFY: 'Infosys',
  ITC: 'ITC',
  KOTAKBANK: 'Kotak Mahindra Bank',
  MARUTI: 'Maruti Suzuki',
  RELIANCE: 'Reliance Industries',
  SBIN: 'State Bank of India',
  SUNPHARMA: 'Sun Pharma',
  TATASTEEL: 'Tata Steel',
  TCS: 'Tata Consultancy',
  WIPRO: 'Wipro',
}

function displayInstrumentName(symbol: string, name: string | undefined, exchange: string): string {
  const trimmed = name?.trim()
  if (trimmed && trimmed.toUpperCase() !== symbol.toUpperCase()) return trimmed
  return DEFAULT_INSTRUMENT_NAMES[symbol.toUpperCase()] ?? exchange
}

function formatVolume(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(Math.round(value))
}
