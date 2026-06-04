import type { IndicatorPoint } from '@/lib/types'
import { IndicatorEmptyState } from './indicator-empty-state'

const WIDTH = 1000
const HEIGHT = 128
const PAD_X = 36
const PAD_Y = 14

export function RsiPanel({ points }: { points: IndicatorPoint[] }) {
  const hasData = points.some((point) => point.value != null)
  if (!hasData) {
    return (
      <div className="relative h-32 border-t border-border bg-bg-2">
        <IndicatorEmptyState
          title="RSI unavailable"
          hint="RSI unavailable — candle data required."
        />
      </div>
    )
  }

  return (
    <div className="relative h-32 border-t border-border bg-bg-2">
      <div className="absolute left-3 top-2 z-10 text-xs font-mono uppercase text-text-faint">RSI</div>
      <svg className="h-full w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        {[30, 50, 70].map((level) => (
          <g key={level}>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={yAt(level)}
              y2={yAt(level)}
              stroke={level === 50 ? 'rgba(255,255,255,0.10)' : 'rgba(245,158,11,0.22)'}
              strokeDasharray={level === 50 ? undefined : '5 5'}
            />
            <text x={WIDTH - PAD_X + 8} y={yAt(level) + 3} fill="#475569" fontSize="10">{level}</text>
          </g>
        ))}
        {buildSegments(points).map((segment, index) => (
          <polyline
            key={index}
            points={segment}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  )
}

function buildSegments(points: IndicatorPoint[]): string[] {
  const segments: string[] = []
  let current: string[] = []
  points.forEach((point, index) => {
    if (point.value == null) {
      if (current.length > 1) segments.push(current.join(' '))
      current = []
      return
    }
    current.push(`${xAt(index, points.length)},${yAt(point.value)}`)
  })
  if (current.length > 1) segments.push(current.join(' '))
  return segments
}

function xAt(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2
  return PAD_X + (index * (WIDTH - PAD_X * 2)) / (count - 1)
}

function yAt(value: number): number {
  return HEIGHT - PAD_Y - (Math.max(0, Math.min(100, value)) / 100) * (HEIGHT - PAD_Y * 2)
}
