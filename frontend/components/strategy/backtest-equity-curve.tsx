import type { BacktestEquityPoint } from '@/lib/types'
import { StrategyEmptyState } from './strategy-empty-state'

const WIDTH = 520
const HEIGHT = 150
const PAD = 14

export function BacktestEquityCurve({ points }: { points: BacktestEquityPoint[] }) {
  if (points.length === 0) {
    return (
      <StrategyEmptyState
        title="No equity curve"
        hint="Equity points appear after completed backtest trades."
      />
    )
  }

  const values = points.map((point) => point.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const path = points
    .map((point, index) => `${xAt(index, points.length)},${yAt(point.equity, min, max)}`)
    .join(' ')

  return (
    <div className="rounded-sm border border-border bg-panel/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-text">Equity Curve</span>
        <span className="text-xs font-mono text-text-faint">{points.length} points</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[150px] w-full" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1={PAD}
            x2={WIDTH - PAD}
            y1={PAD + (line * (HEIGHT - PAD * 2)) / 3}
            y2={PAD + (line * (HEIGHT - PAD * 2)) / 3}
            stroke="rgba(255,255,255,0.06)"
          />
        ))}
        <polyline points={path} fill="none" stroke="#38bdf8" strokeWidth="2" />
      </svg>
    </div>
  )
}

function xAt(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2
  return PAD + (index * (WIDTH - PAD * 2)) / (count - 1)
}

function yAt(value: number, min: number, max: number): number {
  if (min === max) return HEIGHT / 2
  return HEIGHT - PAD - ((value - min) / (max - min)) * (HEIGHT - PAD * 2)
}
