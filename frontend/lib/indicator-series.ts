import type {
  BollingerPoint,
  Candle,
  IndicatorPoint,
  IndicatorSeries,
  MacdPoint,
} from './types'

export function mapLineSeries(
  candles: Candle[],
  values?: IndicatorSeries
): IndicatorPoint[] {
  const count = Math.min(candles.length, values?.length ?? 0)
  const points: IndicatorPoint[] = []
  for (let index = 0; index < count; index += 1) {
    points.push({
      time: candleTime(candles[index], index),
      value: finiteOrNull(values?.[index]),
    })
  }
  return points
}

export function mapBollingerSeries(
  candles: Candle[],
  bands?: {
    middle?: IndicatorSeries
    upper?: IndicatorSeries
    lower?: IndicatorSeries
  }
): BollingerPoint[] {
  const count = Math.min(
    candles.length,
    bands?.middle?.length ?? 0,
    bands?.upper?.length ?? 0,
    bands?.lower?.length ?? 0
  )
  const points: BollingerPoint[] = []
  for (let index = 0; index < count; index += 1) {
    points.push({
      time: candleTime(candles[index], index),
      middle: finiteOrNull(bands?.middle?.[index]),
      upper: finiteOrNull(bands?.upper?.[index]),
      lower: finiteOrNull(bands?.lower?.[index]),
    })
  }
  return points
}

export function mapMacdSeries(
  candles: Candle[],
  macdResult?: {
    macd?: IndicatorSeries
    signal?: IndicatorSeries
    histogram?: IndicatorSeries
  }
): MacdPoint[] {
  const count = Math.min(
    candles.length,
    macdResult?.macd?.length ?? 0,
    macdResult?.signal?.length ?? 0,
    macdResult?.histogram?.length ?? 0
  )
  const points: MacdPoint[] = []
  for (let index = 0; index < count; index += 1) {
    points.push({
      time: candleTime(candles[index], index),
      macd: finiteOrNull(macdResult?.macd?.[index]),
      signal: finiteOrNull(macdResult?.signal?.[index]),
      histogram: finiteOrNull(macdResult?.histogram?.[index]),
    })
  }
  return points
}

export function latestNonNull(values?: Array<number | null>): number | null {
  if (!values) return null
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function formatIndicatorValue(value: number | null): string {
  return value == null ? '\u2014' : value.toFixed(2)
}

function candleTime(candle: Candle | undefined, fallbackIndex: number): string | number {
  return candle?.time ?? fallbackIndex
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
