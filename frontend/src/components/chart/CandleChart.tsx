'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
} from 'lightweight-charts'
import type { CandlestickData, IChartApi, LineData, Time } from 'lightweight-charts'
import { TOKENS } from '@/lib/tokens'
import type { Candle } from '@/lib/types'

interface CandleChartProps {
  candles: Candle[]
  isDemo: boolean
  activeIndicators: string[]
}

const priceFormatter = (price: number) => `\u20B9${price.toLocaleString('en-IN')}`

export function CandleChart({ candles, isDemo, activeIndicators }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const chartData = useMemo(() => normalizeChartData(candles), [candles])
  const showEma = activeIndicators.includes('EMA')
  const showVwap = activeIndicators.includes('VWAP')

  useEffect(() => {
    const container = containerRef.current
    if (!container || chartData.length === 0) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: TOKENS.base },
        textColor: TOKENS.textMuted,
      },
      grid: { vertLines: { color: '#ffffff06' }, horzLines: { color: '#ffffff06' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#ffffff10', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#ffffff10', timeVisible: true, secondsVisible: false },
      localization: { priceFormatter },
    })

    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: TOKENS.up,
      downColor: TOKENS.dn,
      borderUpColor: TOKENS.up,
      borderDownColor: TOKENS.dn,
      wickUpColor: TOKENS.up,
      wickDownColor: TOKENS.dn,
    })
    candleSeries.setData(chartData)

    if (showEma) {
      const ema9 = chart.addSeries(LineSeries, {
        color: '#60A5FA',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      ema9.setData(calculateEma(chartData, 9))

      const ema21 = chart.addSeries(LineSeries, {
        color: '#A78BFA',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      ema21.setData(calculateEma(chartData, 21))
    }

    if (showVwap) {
      const vwap = chart.addSeries(LineSeries, {
        color: '#34D399',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      vwap.setData(calculateVwap(chartData))
    }

    chart.timeScale().fitContent()

    const observer = new ResizeObserver(([entry]) => {
      chart.resize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chartRef.current = null
      chart.remove()
    }
  }, [chartData, showEma, showVwap])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {isDemo && (
        <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-text-muted">
          Demo mode - static market replay
        </div>
      )}
    </div>
  )
}

function normalizeChartData(candles: Candle[]): CandlestickData<Time>[] {
  return candles
    .map((candle) => {
      const time = normalizeTime(candle.time)
      const open = Number(candle.open)
      const high = Number(candle.high)
      const low = Number(candle.low)
      const close = Number(candle.close)
      if (!time || ![open, high, low, close].every(Number.isFinite)) return null

      return {
        time,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
      }
    })
    .filter((candle): candle is CandlestickData<Time> => candle !== null)
    .sort((a, b) => Number(a.time) - Number(b.time))
}

function normalizeTime(time: Candle['time']): Time | null {
  if (typeof time === 'number') {
    return (time > 100_000_000_000 ? Math.floor(time / 1000) : time) as Time
  }
  const numeric = Number(time)
  if (Number.isFinite(numeric)) {
    return (numeric > 100_000_000_000 ? Math.floor(numeric / 1000) : numeric) as Time
  }
  const parsed = Date.parse(time)
  return Number.isFinite(parsed) ? (Math.floor(parsed / 1000) as Time) : null
}

function calculateEma(data: CandlestickData<Time>[], period: number): LineData<Time>[] {
  if (data.length === 0) return []
  const multiplier = 2 / (period + 1)
  let ema = data[0].close

  return data.map((point, index) => {
    ema = index === 0 ? point.close : (point.close - ema) * multiplier + ema
    return { time: point.time, value: ema }
  })
}

function calculateVwap(data: CandlestickData<Time>[]): LineData<Time>[] {
  let cumulativeTypicalVolume = 0
  let cumulativeVolume = 0

  return data.map((point, index) => {
    const volume = 1 + index * 0.015
    const typical = (point.high + point.low + point.close) / 3
    cumulativeTypicalVolume += typical * volume
    cumulativeVolume += volume
    return { time: point.time, value: cumulativeTypicalVolume / cumulativeVolume }
  })
}
