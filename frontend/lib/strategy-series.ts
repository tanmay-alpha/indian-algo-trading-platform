import type { Candle, ChartSignalMarker, StrategySignal } from './types'

export function mapSignalsToMarkers(
  candles: Candle[],
  signals: StrategySignal[]
): ChartSignalMarker[] {
  return signals
    .filter((signal) => signal.action === 'BUY' || signal.action === 'EXIT')
    .map((signal) => {
      const matched = nearestCandle(candles, signal.timestamp)
      return {
        time: matched?.time ?? signal.timestamp,
        action: signal.action,
        price: signal.price,
        strength: signal.strength,
        reason: signal.reason,
      }
    })
}

export function latestSignal(signals: StrategySignal[]): StrategySignal | null {
  return signals.length > 0 ? signals[signals.length - 1] : null
}

function nearestCandle(candles: Candle[], timestamp: string): Candle | null {
  if (candles.length === 0) return null
  const target = toMillis(timestamp)
  if (target == null) {
    return candles.find((candle) => String(candle.time) === timestamp) ?? null
  }

  let best: Candle | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candle of candles) {
    const candleTs = toMillis(candle.time)
    if (candleTs == null) continue
    const distance = Math.abs(candleTs - target)
    if (distance < bestDistance) {
      best = candle
      bestDistance = distance
    }
  }
  return best
}

function toMillis(value: string | number): number | null {
  if (typeof value === 'number') {
    return value > 10_000_000_000 ? value : value * 1000
  }
  const parsedNumber = Number(value)
  if (Number.isFinite(parsedNumber)) {
    return parsedNumber > 10_000_000_000 ? parsedNumber : parsedNumber * 1000
  }
  const parsedDate = Date.parse(value)
  return Number.isFinite(parsedDate) ? parsedDate : null
}

