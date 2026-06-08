'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { DEMO_SYMBOLS } from '@/lib/demoSymbols'
import type { Candle } from '@/lib/types'

const CandleChart = dynamic(
  () => import('./CandleChart').then((module) => module.CandleChart),
  { ssr: false }
)

interface ChartAreaProps {
  candles: Candle[]
  isDemo: boolean
  isLoading: boolean
}

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: 'D', value: '1d' },
] as const

const INDICATORS = ['EMA', 'VWAP', 'BB', 'RSI', 'MACD', 'ATR'] as const

function formatPrice(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export function ChartArea({ candles, isDemo, isLoading }: ChartAreaProps) {
  const activeSym = useTerminalStore((state) => state.activeSym)
  const timeframe = useTerminalStore((state) => state.chartTimeframe)
  const setChartTimeframe = useTerminalStore((state) => state.setChartTimeframe)
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

  const toggleIndicator = (indicator: string) => {
    setActiveIndicators((current) =>
      current.includes(indicator)
        ? current.filter((item) => item !== indicator)
        : [...current, indicator]
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-base">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-panel px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-[12px] font-medium text-primary">{activeSym}</div>
            <div className="truncate text-[10px] text-muted">{selected.name}</div>
          </div>
          <div className="font-mono text-[13px] text-primary">₹{formatPrice(currentPrice)}</div>
          <div
            className={[
              'rounded-sm border px-1.5 py-0.5 font-mono text-[10px]',
              positive ? 'border-up bg-up/10 text-up' : 'border-dn bg-dn/10 text-dn',
            ].join(' ')}
          >
            {positive ? '+' : ''}{changePct.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </div>
          {isLoading && (
            <div className="font-mono text-[10px] text-muted">syncing {activeTfLabel}</div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((item) => {
            const active = timeframe === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setChartTimeframe(item.value)}
                className={[
                  'h-6 rounded-sm border px-2 font-mono text-[10px] transition-colors',
                  active
                    ? 'border-accent bg-accent-dim text-accent'
                    : 'border-border bg-base text-muted hover:border-strong hover:text-primary',
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
                'h-5 rounded-sm border px-2 font-mono text-[10px] transition-colors',
                active
                  ? 'border-accent bg-transparent text-accent'
                  : 'border-border bg-transparent text-muted hover:border-strong hover:text-primary',
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
