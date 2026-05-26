import { useEffect, useRef, useState } from 'react'
import { createChart, LineStyle, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts'
import type {
  BollingerPoint,
  Candle,
  ChartSignalMarker,
  ChartOverlayState,
  IndicatorResultsResponse,
  PatternMarker,
} from '@/lib/types'
import {
  mapBollingerSeries,
  mapLineSeries,
} from '@/lib/indicator-series'
import { cn, marketSessionLabel } from '@/lib/utils'
import { getPatternsForSymbol } from '@/lib/api'

export function IndicatorChartShell({
  symbol,
  timeframe,
  candles,
  result,
  overlays,
  signalMarkers = [],
  apiStatus = 'ONLINE',
  backendWakeState = 'ONLINE',
  isFetching = false,
  onFetchCandles,
}: {
  symbol: string | null
  timeframe: string
  candles: Candle[]
  result?: IndicatorResultsResponse
  overlays: ChartOverlayState
  signalMarkers?: ChartSignalMarker[]
  apiStatus?: string
  backendWakeState?: string
  isFetching?: boolean
  onFetchCandles?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [patterns, setPatterns] = useState<PatternMarker[]>([])
  const [patternsLoading, setPatternsLoading] = useState(false)
  const [hoveredData, setHoveredData] = useState<{
    time: number
    open: number
    high: number
    low: number
    close: number
    pattern?: string
    patternDesc?: string
    signal?: string
    signalDesc?: string
  } | null>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    title: string
    description: string
    color: string
  } | null>(null)

  // Fetch pattern markers when candles/symbol/timeframe change
  useEffect(() => {
    if (!symbol || candles.length === 0) {
      setPatterns([])
      return
    }

    let active = true
    setPatternsLoading(true)
    getPatternsForSymbol(symbol, timeframe)
      .then((res) => {
        if (active && res.available) {
          setPatterns(res.markers)
        }
      })
      .catch((err) => {
        console.error('Error fetching pattern markers:', err)
      })
      .finally(() => {
        if (active) setPatternsLoading(false)
      })

    return () => {
      active = false
    }
  }, [symbol, timeframe, candles.length])

  // Initialize and update Lightweight Chart
  useEffect(() => {
    if (candles.length === 0 || !containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: '#070b12' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.06)' },
      },
      crosshair: {
        mode: 1, // Normal
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ea3943',
      borderDownColor: '#ea3943',
      borderUpColor: '#16c784',
      wickDownColor: '#ea3943',
      wickUpColor: '#16c784',
    })

    const chartData = candles.map((c) => {
      let t = typeof c.time === 'number' ? c.time : Number(c.time)
      if (isNaN(t)) {
        t = Math.floor(Date.parse(c.time as string) / 1000)
      } else if (t > 100_000_000_000) {
        t = Math.floor(t / 1000)
      }
      return {
        time: t,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }
    })

    chartData.sort((a, b) => (a.time as number) - (b.time as number))
    candlestickSeries.setData(chartData as any)

    // Fit content
    chart.timeScale().fitContent()

    // Add EMA
    if (overlays.ema) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: '#54c1ec',
        lineWidth: 2,
      })
      const emaPoints = mapLineSeries(candles, result?.results.ema)
      const emaData = emaPoints.map((point, index) => {
        const candle = candles[index]
        const t = getEpochSeconds(candle.time)
        return t !== null ? { time: t, value: point.value } : null
      }).filter((p): p is { time: number; value: number } => p !== null && p.value !== null && p.value !== undefined)
      
      emaSeries.setData(emaData as any)
    }

    // Add VWAP
    if (overlays.vwap) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color: '#f0a928',
        lineWidth: 2,
      })
      const vwapPoints = mapLineSeries(candles, result?.results.vwap)
      const vwapData = vwapPoints.map((point, index) => {
        const candle = candles[index]
        const t = getEpochSeconds(candle.time)
        return t !== null ? { time: t, value: point.value } : null
      }).filter((p): p is { time: number; value: number } => p !== null && p.value !== null && p.value !== undefined)
      
      vwapSeries.setData(vwapData as any)
    }

    // Add Bollinger Bands
    if (overlays.bollinger_bands) {
      const upperSeries = chart.addSeries(LineSeries, {
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      })
      const middleSeries = chart.addSeries(LineSeries, {
        color: '#475569',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      })
      const lowerSeries = chart.addSeries(LineSeries, {
        color: '#64748b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      })

      const bandPoints = mapBollingerSeries(candles, result?.results.bollinger_bands)
      const upperData: any[] = []
      const middleData: any[] = []
      const lowerData: any[] = []

      bandPoints.forEach((point, index) => {
        const candle = candles[index]
        const t = getEpochSeconds(candle.time)
        if (t === null) return

        if (point.upper !== null && point.upper !== undefined) {
          upperData.push({ time: t, value: point.upper })
        }
        if (point.middle !== null && point.middle !== undefined) {
          middleData.push({ time: t, value: point.middle })
        }
        if (point.lower !== null && point.lower !== undefined) {
          lowerData.push({ time: t, value: point.lower })
        }
      })

      upperSeries.setData(upperData as any)
      middleSeries.setData(middleData as any)
      lowerSeries.setData(lowerData as any)
    }

    // Construct Markers
    const candleSecondsList = chartData.map((d) => d.time as number)
    const merged: Record<number, any> = {}

    patterns.forEach((p) => {
      const pTime = getEpochSeconds(p.time)
      if (pTime === null) return
      const candleTime = mapTimeToCandleSec(pTime, candleSecondsList)
      if (candleTime === null) return

      merged[candleTime] = {
        time: candleTime,
        position: p.direction === 'bullish' ? 'belowBar' : 'aboveBar',
        shape: p.direction === 'bullish' ? 'arrowUp' : (p.direction === 'bearish' ? 'arrowDown' : 'circle'),
        color: p.direction === 'bullish' ? '#10b981' : (p.direction === 'bearish' ? '#ef4444' : '#94a3b8'),
        text: p.pattern,
        description: p.description,
        isPattern: true,
      }
    })

    signalMarkers.forEach((s) => {
      const sTime = getEpochSeconds(s.time)
      if (sTime === null) return
      const candleTime = mapTimeToCandleSec(sTime, candleSecondsList)
      if (candleTime === null) return

      const existing = merged[candleTime]
      const isBuy = s.action === 'BUY'

      if (existing) {
        merged[candleTime] = {
          ...existing,
          position: isBuy ? 'belowBar' : 'aboveBar',
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          color: isBuy ? '#16c784' : '#f0a928',
          text: `${s.action} (${existing.text})`,
          description: `${s.action}: ${s.reason || 'Backtest signal'} | ${existing.description}`,
          isSignal: true,
        }
      } else {
        merged[candleTime] = {
          time: candleTime,
          position: isBuy ? 'belowBar' : 'aboveBar',
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          color: isBuy ? '#16c784' : '#f0a928',
          text: s.action,
          description: `${s.action}: ${s.reason || 'Backtest signal'}`,
          isSignal: true,
        }
      }
    })

    const finalMarkersList = Object.values(merged).sort((a, b) => a.time - b.time)
    createSeriesMarkers(candlestickSeries, finalMarkersList as any)

    // Subscribe to crosshair moves
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoveredData(null)
        setTooltip(null)
        return
      }

      const timeVal = param.time as number
      const candle = chartData.find((c) => c.time === timeVal)
      if (!candle) {
        setHoveredData(null)
        setTooltip(null)
        return
      }

      const marker = finalMarkersList.find((m) => m.time === timeVal)

      setHoveredData({
        time: timeVal,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        pattern: marker?.isPattern || marker?.text ? marker.text : undefined,
        patternDesc: marker?.description,
        signal: marker?.isSignal ? marker.text : undefined,
        signalDesc: marker?.description,
      })

      if (marker) {
        setTooltip({
          x: param.point.x,
          y: param.point.y,
          title: marker.text,
          description: marker.description,
          color: marker.color,
        })
      } else {
        setTooltip(null)
      }
    })

    // Resize Observer
    const handleResize = () => {
      if (containerRef.current && chart) {
        chart.resize(containerRef.current.clientWidth, 360)
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [candles, result, overlays, signalMarkers, patterns])

  if (candles.length === 0) {
    const empty = chartEmptyCopy(apiStatus, backendWakeState)
    return (
      <div className="relative flex-1 min-h-[360px] overflow-hidden bg-[#070b12]">
        <div className="absolute inset-0 opacity-70 chart-grid" />
        <div className="relative z-10 flex h-full min-h-[360px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-panel-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-faint"
            >
              <path d="M3 3v18h18M9 9l3 3 3-3 3 3" />
            </svg>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-text-2">{empty.title}</div>
            <div className="max-w-[280px] text-[11px] leading-relaxed text-text-faint">
              {symbol
                ? `Select a timeframe and load candles for ${symbol} to enable chart and indicators.`
                : 'Select a symbol from the watchlist to begin.'}
            </div>
          </div>
          {symbol && (
            <button
              type="button"
              onClick={onFetchCandles}
              disabled={isFetching || !onFetchCandles}
              className={cn(
                'flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[11px]',
                'border-info/25 bg-info/5 text-info hover:bg-info/10',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors'
              )}
            >
              {isFetching ? 'Loading...' : "Load Today's Candles"}
            </button>
          )}
          <div className="max-w-[300px] rounded border border-border/50 px-3 py-2 text-[10px] text-text-faint">
            Candles are fetched from Angel One API and cached in memory. No synthetic data is generated.
          </div>
        </div>
      </div>
    )
  }

  // Bounding box checks for tooltip positioning inside the container
  const tooltipX = tooltip
    ? tooltip.x > (containerRef.current?.clientWidth || 0) - 220
      ? tooltip.x - 215
      : tooltip.x + 15
    : 0

  const tooltipY = tooltip
    ? tooltip.y > 360 - 100
      ? tooltip.y - 85
      : tooltip.y + 15
    : 0

  return (
    <div className="relative flex-1 min-h-[360px] overflow-hidden bg-[#070b12]">
      {/* Absolute Header Overlay */}
      <div className="absolute left-4 right-16 top-4 h-12 rounded-md border border-border bg-bg-2/85 backdrop-blur-sm flex items-center justify-between px-3 z-10 pointer-events-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">{symbol ?? 'Select a symbol'}</span>
            <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] font-mono text-text-dim">
              {timeframe}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-text-faint">
            Candles: {candles.length} / Overlays from IndicatorEngine {patternsLoading && '(Recalculating Patterns...)'}
          </div>
        </div>
      </div>

      {/* Interactive OHLC and Pattern/Signal Legend Overlay */}
      {hoveredData && (
        <div className="absolute right-4 top-4 z-20 rounded-md border border-border bg-bg-2/90 backdrop-blur-sm px-3 py-1.5 text-[11px] flex items-center gap-3 font-mono">
          <span className="text-text-faint">O:</span><span className="text-text">{hoveredData.open.toFixed(2)}</span>
          <span className="text-text-faint">H:</span><span className="text-text">{hoveredData.high.toFixed(2)}</span>
          <span className="text-text-faint">L:</span><span className="text-text">{hoveredData.low.toFixed(2)}</span>
          <span className="text-text-faint">C:</span><span className="text-text-emerald">{hoveredData.close.toFixed(2)}</span>
          {(hoveredData.pattern || hoveredData.signal) && (
            <div className="flex items-center gap-1.5 border-l border-border pl-3">
              {hoveredData.signal && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold",
                  hoveredData.signal.includes("BUY") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                )}>
                  {hoveredData.signal}
                </span>
              )}
              {hoveredData.pattern && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {hoveredData.pattern}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pattern/Signal Floating Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-30 rounded-md border border-border bg-bg-2/95 shadow-xl px-3 py-2 text-[11px] max-w-[200px]"
          style={{
            left: `${tooltipX}px`,
            top: `${tooltipY}px`,
            borderColor: tooltip.color,
            borderWidth: '1px',
          }}
        >
          <div className="font-bold mb-1" style={{ color: tooltip.color }}>
            {tooltip.title}
          </div>
          <div className="text-text-dim text-[10px] leading-snug">
            {tooltip.description}
          </div>
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} className="w-full h-[360px]" />
    </div>
  )
}

function chartEmptyCopy(apiStatus: string, backendWakeState: string): { title: string; hint: string } {
  const session = marketSessionLabel()
  if (backendWakeState === 'WAKING') {
    return {
      title: 'Waiting for backend data',
      hint: 'The backend is waking up. Chart data will load automatically when REST status returns.',
    }
  }
  if (apiStatus === 'OFFLINE') {
    return {
      title: 'Backend unavailable',
      hint: 'Chart data cannot be loaded until the backend is reachable. No synthetic data is shown.',
    }
  }
  if (session !== 'LIVE') {
    return {
      title: 'Market closed - no live candles expected',
      hint: 'Use fetched historical candles for this symbol/timeframe. No synthetic data is shown.',
    }
  }
  return {
    title: 'No candle data available',
    hint: 'Load candles for this symbol/timeframe to enable chart overlays and indicators.',
  }
}

// Helpers
function getEpochSeconds(time: string | number): number | null {
  if (typeof time === 'number') {
    return time > 100_000_000_000 ? Math.floor(time / 1000) : time
  }
  const parsed = Number(time)
  if (Number.isFinite(parsed)) {
    return parsed > 100_000_000_000 ? Math.floor(parsed / 1000) : parsed
  }
  const dateVal = Date.parse(time)
  if (Number.isFinite(dateVal)) {
    return Math.floor(dateVal / 1000)
  }
  return null
}

function mapTimeToCandleSec(time: string | number, candleTimes: number[]): number | null {
  const tSec = getEpochSeconds(time)
  if (tSec === null || candleTimes.length === 0) return null

  let bestTime = candleTimes[0]
  let minDiff = Math.abs(bestTime - tSec)
  for (let i = 1; i < candleTimes.length; i++) {
    const diff = Math.abs(candleTimes[i] - tSec)
    if (diff < minDiff) {
      minDiff = diff
      bestTime = candleTimes[i]
    }
  }
  return bestTime
}
