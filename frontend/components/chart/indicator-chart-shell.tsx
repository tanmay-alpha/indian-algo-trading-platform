import type {
  BollingerPoint,
  Candle,
  ChartOverlayState,
  IndicatorResultsResponse,
} from '@/lib/types'
import {
  mapBollingerSeries,
  mapLineSeries,
} from '@/lib/indicator-series'
import { IndicatorEmptyState } from './indicator-empty-state'

const WIDTH = 1000
const HEIGHT = 360
const PAD_X = 36
const PAD_Y = 22

export function IndicatorChartShell({
  symbol,
  timeframe,
  candles,
  result,
  overlays,
}: {
  symbol: string | null
  timeframe: string
  candles: Candle[]
  result?: IndicatorResultsResponse
  overlays: ChartOverlayState
}) {
  if (candles.length === 0) {
    return (
      <div className="relative flex-1 min-h-[360px] overflow-hidden bg-[#070b12]">
        <div className="absolute inset-0 opacity-70 chart-grid" />
        <IndicatorEmptyState
          title="No candle data loaded"
          hint="Fetch or stream candles from the backend to render chart overlays. No synthetic OHLCV is rendered."
        />
      </div>
    )
  }

  const ema = mapLineSeries(candles, result?.results.ema)
  const vwap = mapLineSeries(candles, result?.results.vwap)
  const bands = mapBollingerSeries(candles, result?.results.bollinger_bands)
  const range = priceRange(candles, overlays, ema, vwap, bands)

  return (
    <div className="relative flex-1 min-h-[360px] overflow-hidden bg-[#070b12]">
      <div className="absolute inset-0 opacity-70 chart-grid" />
      <div className="absolute left-4 right-16 top-4 h-12 rounded-md border border-border bg-bg-2/85 backdrop-blur-sm flex items-center justify-between px-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">{symbol ?? 'Select a symbol'}</span>
            <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] font-mono text-text-dim">
              {timeframe}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-text-faint">
            Candles: {candles.length} / Overlays from IndicatorEngine
          </div>
        </div>
      </div>

      <svg
        className="absolute inset-x-0 top-16 bottom-0 h-[calc(100%-4rem)] w-full"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="MAET candle chart with indicator overlays"
      >
        <ChartGrid />
        {candles.map((candle, index) => (
          <CandleGlyph
            key={`${candle.time}-${index}`}
            candle={candle}
            index={index}
            count={candles.length}
            range={range}
          />
        ))}
        {overlays.bollinger_bands && (
          <>
            <LineSegments points={bands} range={range} color="#64748b" valueOf={(p) => p.upper} dash />
            <LineSegments points={bands} range={range} color="#475569" valueOf={(p) => p.middle} dash />
            <LineSegments points={bands} range={range} color="#64748b" valueOf={(p) => p.lower} dash />
          </>
        )}
        {overlays.ema && <LineSegments points={ema} range={range} color="#54c1ec" valueOf={(p) => p.value} />}
        {overlays.vwap && <LineSegments points={vwap} range={range} color="#f0a928" valueOf={(p) => p.value} />}
      </svg>
    </div>
  )
}

function ChartGrid() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`h-${i}`}
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={PAD_Y + (i * (HEIGHT - PAD_Y * 2)) / 4}
          y2={PAD_Y + (i * (HEIGHT - PAD_Y * 2)) / 4}
          stroke="rgba(255,255,255,0.06)"
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={`v-${i}`}
          y1={PAD_Y}
          y2={HEIGHT - PAD_Y}
          x1={PAD_X + (i * (WIDTH - PAD_X * 2)) / 5}
          x2={PAD_X + (i * (WIDTH - PAD_X * 2)) / 5}
          stroke="rgba(255,255,255,0.04)"
        />
      ))}
    </>
  )
}

function CandleGlyph({
  candle,
  index,
  count,
  range,
}: {
  candle: Candle
  index: number
  count: number
  range: PriceRange
}) {
  const x = xAt(index, count)
  const openY = yAt(candle.open, range)
  const closeY = yAt(candle.close, range)
  const highY = yAt(candle.high, range)
  const lowY = yAt(candle.low, range)
  const up = candle.close >= candle.open
  const color = up ? '#16c784' : '#ea3943'
  const bodyTop = Math.min(openY, closeY)
  const bodyHeight = Math.max(Math.abs(closeY - openY), 1.2)
  const width = Math.max(Math.min((WIDTH - PAD_X * 2) / Math.max(count, 1) * 0.52, 8), 2)

  return (
    <g opacity={0.9}>
      <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={1.4} />
      <rect
        x={x - width / 2}
        y={bodyTop}
        width={width}
        height={bodyHeight}
        fill={up ? 'rgba(22,199,132,0.28)' : 'rgba(234,57,67,0.28)'}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  )
}

function LineSegments<T>({
  points,
  range,
  color,
  valueOf,
  dash = false,
}: {
  points: T[]
  range: PriceRange
  color: string
  valueOf: (point: T) => number | null
  dash?: boolean
}) {
  const segments = buildSegments(points, range, valueOf)
  return (
    <>
      {segments.map((segment, index) => (
        <polyline
          key={`${color}-${index}`}
          points={segment}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash ? '6 5' : undefined}
        />
      ))}
    </>
  )
}

interface PriceRange {
  min: number
  max: number
}

function priceRange(
  candles: Candle[],
  overlays: ChartOverlayState,
  ema: Array<{ value: number | null }>,
  vwap: Array<{ value: number | null }>,
  bands: BollingerPoint[]
): PriceRange {
  const values: number[] = []
  for (const candle of candles) values.push(candle.high, candle.low)
  if (overlays.ema) values.push(...ema.map((point) => point.value).filter(isFiniteNumber))
  if (overlays.vwap) values.push(...vwap.map((point) => point.value).filter(isFiniteNumber))
  if (overlays.bollinger_bands) {
    values.push(...bands.flatMap((point) => [point.upper, point.middle, point.lower]).filter(isFiniteNumber))
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.08, 0.01)
  return { min: min - pad, max: max + pad }
}

function buildSegments<T>(
  points: T[],
  range: PriceRange,
  valueOf: (point: T) => number | null
): string[] {
  const segments: string[] = []
  let current: string[] = []
  points.forEach((point, index) => {
    const value = valueOf(point)
    if (value == null || !Number.isFinite(value)) {
      if (current.length > 1) segments.push(current.join(' '))
      current = []
      return
    }
    current.push(`${xAt(index, points.length)},${yAt(value, range)}`)
  })
  if (current.length > 1) segments.push(current.join(' '))
  return segments
}

function xAt(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2
  return PAD_X + (index * (WIDTH - PAD_X * 2)) / (count - 1)
}

function yAt(value: number, range: PriceRange): number {
  if (range.max === range.min) return HEIGHT / 2
  return HEIGHT - PAD_Y - ((value - range.min) / (range.max - range.min)) * (HEIGHT - PAD_Y * 2)
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
