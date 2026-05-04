import type { MacdPoint } from '@/lib/types'
import { IndicatorEmptyState } from './indicator-empty-state'

const WIDTH = 1000
const HEIGHT = 150
const PAD_X = 36
const PAD_Y = 18

export function MacdPanel({ points }: { points: MacdPoint[] }) {
  const hasData = points.some((point) => point.macd != null || point.signal != null || point.histogram != null)
  if (!hasData) {
    return (
      <div className="relative h-36 border-t border-border bg-bg-2">
        <IndicatorEmptyState
          title="MACD unavailable"
          hint="MACD unavailable — candle data required."
        />
      </div>
    )
  }

  const range = macdRange(points)
  const zeroY = yAt(0, range)
  return (
    <div className="relative h-36 border-t border-border bg-bg-2">
      <div className="absolute left-3 top-2 z-10 text-[10px] font-mono uppercase text-text-faint">MACD</div>
      <svg className="h-full w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.12)" />
        {points.map((point, index) => {
          if (point.histogram == null) return null
          const x = xAt(index, points.length)
          const y = yAt(point.histogram, range)
          const up = point.histogram >= 0
          const barWidth = Math.max(Math.min((WIDTH - PAD_X * 2) / Math.max(points.length, 1) * 0.6, 7), 1.5)
          return (
            <rect
              key={`${point.time}-${index}`}
              x={x - barWidth / 2}
              y={Math.min(y, zeroY)}
              width={barWidth}
              height={Math.max(Math.abs(zeroY - y), 1)}
              fill={up ? 'rgba(22,199,132,0.45)' : 'rgba(234,57,67,0.45)'}
            />
          )
        })}
        <MacdLine points={points} range={range} color="#54c1ec" valueOf={(point) => point.macd} />
        <MacdLine points={points} range={range} color="#f0a928" valueOf={(point) => point.signal} />
      </svg>
    </div>
  )
}

function MacdLine({
  points,
  range,
  color,
  valueOf,
}: {
  points: MacdPoint[]
  range: { min: number; max: number }
  color: string
  valueOf: (point: MacdPoint) => number | null
}) {
  return (
    <>
      {buildSegments(points, range, valueOf).map((segment, index) => (
        <polyline
          key={`${color}-${index}`}
          points={segment}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
    </>
  )
}

function buildSegments(
  points: MacdPoint[],
  range: { min: number; max: number },
  valueOf: (point: MacdPoint) => number | null
): string[] {
  const segments: string[] = []
  let current: string[] = []
  points.forEach((point, index) => {
    const value = valueOf(point)
    if (value == null) {
      if (current.length > 1) segments.push(current.join(' '))
      current = []
      return
    }
    current.push(`${xAt(index, points.length)},${yAt(value, range)}`)
  })
  if (current.length > 1) segments.push(current.join(' '))
  return segments
}

function macdRange(points: MacdPoint[]): { min: number; max: number } {
  const values = points
    .flatMap((point) => [point.macd, point.signal, point.histogram])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const pad = Math.max((max - min) * 0.12, 0.01)
  return { min: min - pad, max: max + pad }
}

function xAt(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2
  return PAD_X + (index * (WIDTH - PAD_X * 2)) / (count - 1)
}

function yAt(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) return HEIGHT / 2
  return HEIGHT - PAD_Y - ((value - range.min) / (range.max - range.min)) * (HEIGHT - PAD_Y * 2)
}
