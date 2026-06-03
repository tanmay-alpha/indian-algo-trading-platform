import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  LineStyle,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts'
import type {
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
import {
  normalizeExchangeSymbol,
  getTradingViewChartUrl,
  getAngelOneChartUrl,
} from '@/lib/symbol-links'
import {
  RefreshCw,
  Maximize2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Database,
  AlertTriangle,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
const PATTERN_ABBREVIATIONS: Record<string, string> = {
  'Doji': 'D',
  'Hammer': 'H',
  'Shooting Star': 'SS',
  'Bullish Engulfing': 'BE',
  'Bearish Engulfing': 'BE',
}

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
  const layoutMode = useTerminalStore((s) => s.chartLayoutMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const [patterns, setPatterns] = useState<PatternMarker[]>([])
  const [showPatterns, setShowPatterns] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
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

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Guard ref access for tooltip positioning
  useEffect(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setContainerSize({ w: rect.width, h: rect.height })

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Fetch pattern markers when candles/symbol/timeframe change
  useEffect(() => {
    if (!symbol || candles.length === 0) {
      setPatterns((current) => (current.length > 0 ? [] : current))
      return
    }

    let active = true
    getPatternsForSymbol(symbol, timeframe)
      .then((res) => {
        if (active && res.available) {
          setPatterns(res.markers)
        }
      })
      .catch((err) => {
        console.error('Error fetching pattern markers:', err)
      })

    return () => {
      active = false
    }
  }, [symbol, timeframe, candles.length])

  // Initialize and update Lightweight Chart
  useEffect(() => {
    if (candles.length === 0 || !containerRef.current) return

    // Deduplicate input candles by epoch time to avoid lightweight-charts assertions
    const seenTimes = new Set<number>()
    const uniqueCandles: Candle[] = []
    for (let i = candles.length - 1; i >= 0; i--) {
      const c = candles[i]
      let t = typeof c.time === 'number' ? c.time : Number(c.time)
      if (isNaN(t)) {
        t = Math.floor(Date.parse(c.time as string) / 1000)
      } else if (t > 100_000_000_000) {
        t = Math.floor(t / 1000)
      }
      if (!seenTimes.has(t)) {
        seenTimes.add(t)
        uniqueCandles.push(c)
      }
    }
    uniqueCandles.reverse()
    const resolvedCandles = uniqueCandles

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
    chartRef.current = chart

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ea3943',
      borderDownColor: '#ea3943',
      borderUpColor: '#16c784',
      wickDownColor: '#ea3943',
      wickUpColor: '#16c784',
    })

    const chartData = resolvedCandles.map((c) => {
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

    // Add Volume Series if enabled
    const totalVolume = resolvedCandles.reduce((acc, c) => acc + Number(c.volume || 0), 0)
    const isVolumeAvailable = totalVolume > 0
    if (showVolume && isVolumeAvailable) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume', // Render overlay
      })

      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })

      const volumeData = resolvedCandles.map((c) => {
        const t = getEpochSeconds(c.time)
        const isUp = Number(c.close) >= Number(c.open)
        return t !== null ? {
          time: t,
          value: Number(c.volume || 0),
          color: isUp ? 'rgba(22, 199, 132, 0.25)' : 'rgba(234, 57, 67, 0.25)',
        } : null
      }).filter((v): v is { time: number; value: number; color: string } => v !== null)

      volumeData.sort((a, b) => (a.time as number) - (b.time as number))
      volumeSeries.setData(volumeData as any)
    }

    // Add EMA
    if (overlays.ema) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: '#54c1ec',
        lineWidth: 2,
      })
      const emaPoints = mapLineSeries(resolvedCandles, result?.results.ema)
      const emaData = emaPoints.map((point, index) => {
        const candle = resolvedCandles[index]
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
      const vwapPoints = mapLineSeries(resolvedCandles, result?.results.vwap)
      const vwapData = vwapPoints.map((point, index) => {
        const candle = resolvedCandles[index]
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

      const bandPoints = mapBollingerSeries(resolvedCandles, result?.results.bollinger_bands)
      const upperData: any[] = []
      const middleData: any[] = []
      const lowerData: any[] = []

      bandPoints.forEach((point, index) => {
        const candle = resolvedCandles[index]
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

    if (showPatterns) {
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
          text: PATTERN_ABBREVIATIONS[p.pattern] || p.pattern,
          fullName: p.pattern,
          description: p.description,
          confidence: p.confidence,
          isPattern: true,
        }
      })
    }

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
        pattern: marker?.isPattern ? (marker.fullName || marker.text) : (marker?.text || undefined),
        patternDesc: marker?.description,
        signal: marker?.isSignal ? marker.text : undefined,
        signalDesc: marker?.description,
      })

      if (marker) {
        let displayDesc = marker.description
        if (marker.isPattern && marker.confidence !== undefined) {
          displayDesc = `${displayDesc} (Confidence: ${(marker.confidence * 100).toFixed(0)}%)`
        }
        setTooltip({
          x: param.point.x,
          y: param.point.y,
          title: marker.isPattern ? (marker.fullName || marker.text) : marker.text,
          description: displayDesc,
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
      chartRef.current = null
      chart.remove()
    }
  }, [candles, result, overlays, signalMarkers, patterns, showPatterns, showVolume])

  const handleResetView = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }

  // Symbol link mappings
  const { symbol: cleanSymbol, exchange } = normalizeExchangeSymbol(symbol || '', 'NSE')
  const tvUrl = getTradingViewChartUrl(symbol || '', exchange)
  const aoUrl = getAngelOneChartUrl(symbol || '', exchange)

  // Header quote calculations
  let ltp = '-'
  let changePercent = '-'
  let changeColor = 'text-text'
  let lastVolume = '-'
  let lastCandleTime = '-'
  const totalVolume = candles.reduce((acc, c) => acc + Number(c.volume || 0), 0)
  const isVolumeAvailable = totalVolume > 0

  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1]
    const firstCandle = candles[0]

    ltp = `₹${Number(lastCandle.close).toFixed(2)}`
    if (isVolumeAvailable) {
      lastVolume = Number(lastCandle.volume || 0).toLocaleString('en-IN')
    } else {
      lastVolume = 'N/A'
    }

    const tVal = getEpochSeconds(lastCandle.time)
    if (tVal !== null) {
      lastCandleTime = new Date(tVal * 1000).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    }

    const openVal = Number(firstCandle.open)
    const closeVal = Number(lastCandle.close)
    if (openVal > 0) {
      const diffPct = ((closeVal - openVal) / openVal) * 100
      changePercent = `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%`
      changeColor = diffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
    }
  }

  const session = marketSessionLabel()
  const sourceBadge = candles.length > 0
    ? (session === 'LIVE' ? 'LIVE TICKS' : 'REAL CANDLES')
    : 'NO CANDLES'

  // Toolbar Builder
  const renderToolbar = () => {
    if (layoutMode === 'FOCUS') return null
    return (
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-bg-2/50 px-4 py-2 gap-2 z-10 select-none">
      {/* Left side: quote details & status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text">{cleanSymbol || 'NO SYMBOL'}</span>
          {exchange && (
            <span className="rounded bg-panel px-1.5 py-0.5 text-xs font-bold text-text-dim border border-border/40">
              {exchange}
            </span>
          )}
          <span className="rounded bg-info/10 text-info px-1.5 py-0.5 text-xs font-mono border border-info/25 font-semibold">
            {timeframe}
          </span>
        </div>

        {candles.length > 0 && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-text-faint">LTP:</span>
            <span className="text-text font-bold">{ltp}</span>

            <span className="text-text-faint">Change:</span>
            <span className={cn('font-bold', changeColor)}>{changePercent}</span>

            <span className="text-text-faint">Vol:</span>
            <span className="text-text">{lastVolume}</span>

            <span className="text-text-faint">Candles:</span>
            <span className="text-text">{candles.length}</span>

            <span className="text-text-faint">Last Time:</span>
            <span className="text-text">{lastCandleTime}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs font-bold tracking-wide border',
              sourceBadge === 'LIVE TICKS'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : sourceBadge === 'REAL CANDLES'
                ? 'bg-info/10 text-info border-info/20'
                : 'bg-panel text-text-faint border-border'
            )}
          >
            {sourceBadge}
          </span>
          <span className="rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-xs font-bold flex items-center gap-1">
            <Database size={10} />
            <span>ENGINE: PYTHON</span>
          </span>
        </div>
      </div>

      {/* Right side: Action controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onFetchCandles}
          disabled={isFetching || !symbol}
          title="Fetch latest historical candles from broker cache"
          className="flex items-center gap-1 rounded bg-panel hover:bg-panel-2 border border-border px-2 py-1 text-xs font-medium text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={11} className={cn('text-text-dim', isFetching && 'animate-spin')} />
          <span>{isFetching ? 'Loading...' : 'Refresh'}</span>
        </button>

        <button
          type="button"
          onClick={handleResetView}
          disabled={candles.length === 0}
          title="Reset chart timescale zoom to fit all candles"
          className="flex items-center gap-1 rounded bg-panel hover:bg-panel-2 border border-border px-2 py-1 text-xs font-medium text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Maximize2 size={11} className="text-text-dim" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={() => setShowPatterns(!showPatterns)}
          disabled={candles.length === 0}
          title="Toggle visibility of backend pattern markers on the chart"
          className={cn(
            'flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            showPatterns ? 'bg-info/10 border-info/30 text-info' : 'bg-panel border-border text-text-dim hover:bg-panel-2'
          )}
        >
          {showPatterns ? <Eye size={11} /> : <EyeOff size={11} />}
          <span>Patterns {patterns.length > 0 && `(${patterns.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowVolume(!showVolume)}
          disabled={candles.length === 0 || !isVolumeAvailable}
          title={isVolumeAvailable ? 'Toggle volume overlay series at the bottom of the chart' : 'Volume data unavailable'}
          className={cn(
            'flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            showVolume && isVolumeAvailable ? 'bg-info/10 border-info/30 text-info' : 'bg-panel border-border text-text-dim hover:bg-panel-2'
          )}
        >
          {showVolume && isVolumeAvailable ? <Eye size={11} /> : <EyeOff size={11} />}
          <span>Volume</span>
        </button>

        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Analyze ${cleanSymbol} in a full TradingView chart`}
          className={cn(
            'flex items-center gap-1 rounded bg-panel hover:bg-panel-2 border border-border px-2 py-1 text-xs font-medium text-text transition-colors',
            !symbol && 'opacity-40 pointer-events-none'
          )}
        >
          <ExternalLink size={11} className="text-text-dim" />
          <span>TradingView</span>
        </a>

        <a
          href={aoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens Angel One chart; search symbol there if not auto-selected."
          className={cn(
            'flex items-center gap-1 rounded bg-panel hover:bg-panel-2 border border-border px-2 py-1 text-xs font-medium text-text transition-colors',
            !symbol && 'opacity-40 pointer-events-none'
          )}
        >
          <ExternalLink size={11} className="text-text-dim" />
          <span>Angel One</span>
        </a>
      </div>
    </div>
  )
}

  // Empty state handling
  if (candles.length === 0) {
    let emptyTitle = 'No symbol selected'
    let emptyDescription = 'Select a symbol from Market Watch.'

    if (symbol) {
      if (apiStatus === 'OFFLINE') {
        emptyTitle = 'Backend unavailable'
        emptyDescription = 'Chart data cannot be loaded until the backend is reachable. No synthetic data is shown.'
      } else if (backendWakeState === 'WAKING') {
        emptyTitle = 'Waiting for backend data'
        emptyDescription = 'The backend is waking up. Chart data will load automatically when REST status returns.'
      } else {
        if (session === 'LIVE') {
          emptyTitle = 'Live ticks but no candles loaded'
          emptyDescription = `Live ticks are available, but candles are not loaded yet for ${symbol} / ${timeframe}.`
        } else if (session === 'MARKET CLOSED') {
          emptyTitle = 'Market is closed'
          emptyDescription = `Market is closed. Historical candles can still be loaded for ${symbol} / ${timeframe}.`
        } else {
          emptyTitle = `No candles loaded for ${symbol} / ${timeframe}`
          emptyDescription = 'Historical OHLC data is not loaded yet for this symbol.'
        }
      }
    }

    return (
      <div className="relative flex-1 min-h-[420px] flex flex-col bg-[#070b12] border border-border/80 rounded-lg overflow-hidden">
        {/* Render the toolbar */}
        {renderToolbar()}

        {/* Empty state details */}
        <div className="relative flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center z-0">
          <div className="absolute inset-0 opacity-40 chart-grid pointer-events-none" />

          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-panel-2 shadow-sm relative z-10">
            {apiStatus === 'OFFLINE' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-text-faint animate-pulse"
              >
                <path d="M3 3v18h18M9 9l3 3 3-3 3 3" />
              </svg>
            )}
          </div>

          <div className="relative z-10 max-w-[400px]">
            <div className="mb-1.5 text-sm font-semibold text-text-light">{emptyTitle}</div>
            <div className="text-xs leading-relaxed text-text-dim">{emptyDescription}</div>
          </div>

          {symbol && apiStatus !== 'OFFLINE' && (
            <div className="flex items-center gap-3 relative z-10 mt-2">
              <button
                type="button"
                onClick={onFetchCandles}
                disabled={isFetching}
                className={cn(
                  'flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs font-medium transition-colors shadow-sm',
                  'border-info/30 bg-info/5 text-info hover:bg-info/10',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <RefreshCw size={11} className={cn(isFetching && 'animate-spin')} />
                <span>{isFetching ? 'Loading...' : "Load Today's Candles"}</span>
              </button>

              <a
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs font-medium border-border bg-panel hover:bg-panel-2 text-text transition-colors shadow-sm"
              >
                <ExternalLink size={11} className="text-text-dim" />
                <span>Open in TradingView</span>
              </a>
            </div>
          )}

          <div className="relative z-10 max-w-[340px] rounded border border-border/40 bg-panel/30 px-3 py-2 text-xs text-text-faint mt-4">
            <span className="font-semibold text-text-dim block mb-1">Real Data Policy</span>
            No synthetic candles or dummy prices are used. All chart data maps directly to actual historical broker candles.
          </div>
        </div>
      </div>
    )
  }

  // Positioning calculations for tooltip
  const tooltipX = tooltip
    ? tooltip.x > (containerSize.w || 0) - 220
      ? tooltip.x - 215
      : tooltip.x + 15
    : 0

  const tooltipY = tooltip ? (tooltip.y > 360 - 100 ? tooltip.y - 85 : tooltip.y + 15) : 0

  return (
    <div className="relative flex-1 min-h-[420px] flex flex-col bg-[#070b12] border border-border/80 rounded-lg overflow-hidden">
      {/* 1. Toolbar */}
      {renderToolbar()}

      {/* 2. Legend & Summary Row */}
      {layoutMode === 'ANALYSIS' && (
        <div className="flex flex-wrap items-center justify-between px-4 py-1.5 border-b border-border/40 bg-panel/20 text-xs font-mono text-text-dim select-none z-10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-text-faint font-semibold uppercase tracking-wider text-xs">Markers:</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>Bullish / BUY</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
              <span>Bearish / SELL</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              <span>Neutral / Info</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {showPatterns && (
              <span className="text-info bg-info/5 border border-info/10 px-1.5 py-0.5 rounded flex items-center gap-1 text-xs font-semibold">
                <Sparkles size={10} />
                <span>Patterns: {patterns.length}</span>
              </span>
            )}
            {!isVolumeAvailable && (
              <span className="text-text-faint border border-border bg-panel px-1.5 py-0.5 rounded text-xs">
                Volume Unavailable
              </span>
            )}
            <span className="text-text-faint text-xs">Chart Engine: Lightweight Charts v5</span>
          </div>
        </div>
      )}

      {/* 3. Main Chart Canvas Area */}
      <div className="relative flex-1 bg-[#070b12]">
        {/* Hovered Price Details Panel */}
        {hoveredData && (
          <div className="absolute right-4 top-4 z-20 rounded border border-border/80 bg-[#070b12]/90 backdrop-blur-sm px-2.5 py-1 text-xs flex items-center gap-3.5 font-mono text-text shadow-md select-none">
            <div className="flex items-center gap-1">
              <span className="text-text-faint">O:</span>
              <span className="font-semibold">{hoveredData.open.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-faint">H:</span>
              <span className="font-semibold text-emerald-400">{hoveredData.high.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-faint">L:</span>
              <span className="font-semibold text-rose-400">{hoveredData.low.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-faint">C:</span>
              <span
                className={cn(
                  'font-semibold',
                  hoveredData.close >= hoveredData.open ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {hoveredData.close.toFixed(2)}
              </span>
            </div>
            {(hoveredData.pattern || hoveredData.signal) && (
              <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                {hoveredData.signal && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-bold border',
                      hoveredData.signal.includes('BUY')
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    )}
                  >
                    {hoveredData.signal}
                  </span>
                )}
                {hoveredData.pattern && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
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
            className="absolute pointer-events-none z-30 rounded-md border bg-bg-2/95 shadow-xl px-3 py-2 text-xs max-w-[220px] select-none"
            style={{
              left: `${tooltipX}px`,
              top: `${tooltipY}px`,
              borderColor: tooltip.color,
              borderWidth: '1px',
            }}
          >
            <div className="font-bold mb-1 flex items-center gap-1" style={{ color: tooltip.color }}>
              <Sparkles size={11} />
              <span>{tooltip.title}</span>
            </div>
            <div className="text-text-dim text-xs leading-relaxed">{tooltip.description}</div>
          </div>
        )}

        {/* Chart container */}
        <div ref={containerRef} className="w-full h-[360px]" />
      </div>
    </div>
  )
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
