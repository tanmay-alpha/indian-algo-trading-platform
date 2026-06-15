'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import { useCandles } from '@/hooks/useCandles'
import { useNow } from '@/hooks/useNow'
import { useTerminalStore } from '@/store/terminal-store'
import { formatTickAge, isStale } from '@/lib/stale'
import { cn } from '@/lib/utils'

const CandleChart = dynamic(
  () => import('./CandleChart').then((module) => module.CandleChart),
  { ssr: false }
)

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: 'D', value: '1d' },
] as const

const INDICATORS = ['EMA', 'VWAP', 'BB', 'RSI', 'MACD', 'ATR'] as const

interface ChartAreaProps {
  className?: string
}

export function ChartArea({ className }: ChartAreaProps) {
  const activeSym = useTerminalStore((state) => state.activeSym)
  const timeframe = useTerminalStore((state) => state.chartTimeframe)
  const setChartTimeframe = useTerminalStore((state) => state.setChartTimeframe)
  const lastTickAt = useTerminalStore((state) => state.lastTickBySymbol[activeSym] ?? null)
  const { candles, isDemo, isLoading } = useCandles(activeSym, timeframe)
  const now = useNow(1000)
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['EMA', 'VWAP'])

  const selected = DEMO_SYMBOLS.find((item) => item.sym === activeSym) ?? DEMO_SYMBOLS[0]
  const lastCandle = candles[candles.length - 1]
  const currentPrice = lastCandle?.close ?? selected.price
  const openReference = candles[0]?.open ?? selected.open
  const changePct = openReference > 0 ? ((currentPrice - openReference) / openReference) * 100 : selected.chg
  const positive = changePct >= 0

  const activeTfLabel = useMemo(() => {
    return TIMEFRAMES.find((item) => item.value === timeframe)?.label ?? timeframe
  }, [timeframe])

  const tickAge = formatTickAge(lastTickAt, now)
  const stale = isStale(lastTickAt, now)

  const toggleIndicator = (indicator: string) => {
    setActiveIndicators((current) =>
      current.includes(indicator)
        ? current.filter((item) => item !== indicator)
        : [...current, indicator]
    )
  }

  return (
    <section className={cn('flex min-w-0 flex-1 flex-col bg-base', className)}>
      <div className="flex min-h-10 shrink-0 flex-col gap-2 border-b border-border bg-panel px-3 py-2 sm:h-10 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-[12px] font-medium text-text-primary">{activeSym}</div>
            <div className="truncate text-[10px] text-text-muted">{selected.name}</div>
          </div>
          <div className="font-mono text-[13px] text-text-primary">{formatINR(currentPrice)}</div>
          <div
            className={[
              'rounded border px-1.5 py-0.5 font-mono text-[10px]',
              positive ? 'border-up bg-up-dim text-up' : 'border-dn bg-dn-dim text-dn',
            ].join(' ')}
          >
            {positive ? '+' : ''}{changePct.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}%
          </div>
          {stale ? (
            <div
              className="flex items-center gap-1 rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn"
              role="status"
              aria-label={`Price data is stale. Last tick: ${tickAge ?? 'unknown'}.`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              <span>stale{tickAge ? ` · ${tickAge}` : ''}</span>
            </div>
          ) : tickAge ? (
            <div
              className="font-mono text-[10px] text-text-hint"
              aria-label={`Price as of ${tickAge}`}
            >
              as of {tickAge}
            </div>
          ) : null}
          {isLoading && (
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span>syncing {activeTfLabel}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 overflow-x-auto">
          {TIMEFRAMES.map((item) => {
            const active = timeframe === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setChartTimeframe(item.value)}
                className={[
                  'h-6 rounded border px-2 font-mono text-[10px] transition-colors',
                  active
                    ? 'border-accent/40 bg-accent-dim text-accent'
                    : 'border-border bg-base text-text-muted hover:border-border-light hover:text-text-primary',
                ].join(' ')}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-base">
        <CandleChart candles={candles} isDemo={isDemo} activeIndicators={activeIndicators} />
      </div>

      <div className="flex h-8 shrink-0 items-center gap-1 border-t border-border bg-panel px-3">
        {INDICATORS.map((indicator) => {
          const active = activeIndicators.includes(indicator)
          return (
            <button
              key={indicator}
              type="button"
              onClick={() => toggleIndicator(indicator)}
              className={[
                'h-5 rounded border px-2 font-mono text-[10px] transition-colors',
                active
                  ? 'border-accent/40 bg-accent-dim text-accent'
                  : 'border-border bg-transparent text-text-muted hover:border-border-light hover:text-text-primary',
              ].join(' ')}
            >
              {indicator}
            </button>
          )
        })}
      </div>
    </section>
  )
}
