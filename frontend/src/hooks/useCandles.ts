'use client'

import { useEffect, useMemo, useState } from 'react'
import { DEMO_SYMBOLS } from '@/lib/demoSymbols'
import type { Candle } from '@/lib/types'

interface CandleState {
  candles: Candle[]
  isDemo: boolean
  isLoading: boolean
  error: string | null
}

const MARKET_OPEN_MINUTES = 9 * 60 + 15
const MARKET_CLOSE_MINUTES = 15 * 60 + 30
const IST_OFFSET_MINUTES = 5 * 60 + 30
const LARGE_CAP_MIN_VOLUME = 500_000
const LARGE_CAP_MAX_VOLUME = 5_000_000

function backendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  ).replace(/\/+$/, '')
}

export function useCandles(symbol: string, timeframe: string): CandleState {
  const demoCandles = useMemo(() => generateDemoCandles(symbol, 80, timeframe), [symbol, timeframe])
  const [state, setState] = useState<CandleState>({
    candles: demoCandles,
    isDemo: true,
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 3000)

    setState({
      candles: demoCandles,
      isDemo: true,
      isLoading: true,
      error: null,
    })

    async function loadBackendCandles() {
      try {
        const url = `${backendBaseUrl()}/candles/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const payload = (await response.json()) as { candles?: Candle[] }
        const normalized = normalizeCandles(payload.candles || [])
        if (!active) return

        if (normalized.length > 0) {
          setState({
            candles: normalized,
            isDemo: false,
            isLoading: false,
            error: null,
          })
        } else {
          setState({
            candles: demoCandles,
            isDemo: true,
            isLoading: false,
            error: 'Backend returned no candles',
          })
        }
      } catch (error) {
        if (!active) return
        setState({
          candles: demoCandles,
          isDemo: true,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Candle backend unavailable',
        })
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void loadBackendCandles()

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [demoCandles, symbol, timeframe])

  return state
}

export function generateDemoCandles(symbol: string, count: number, timeframe = '5m'): Candle[] {
  const base = DEMO_SYMBOLS.find((item) => item.sym === symbol)?.price ?? DEMO_SYMBOLS[0].price
  const intervalMinutes = timeframeToMinutes(timeframe)
  const times = marketTimes(count, intervalMinutes)
  const random = seededRandom(hashSymbol(symbol) + hashSymbol(timeframe))
  let previousClose = base * (0.985 + random() * 0.03)

  return times.map((time, index) => {
    const drift = Math.sin(index / 9) * 0.002 + (random() - 0.5) * 0.006
    const open = previousClose
    const close = Math.max(1, open * (1 + drift))
    const spreadBase = Math.max(open, close) * (0.0015 + random() * 0.006)
    const high = Math.max(open, close) + spreadBase * (0.45 + random())
    const low = Math.max(0.05, Math.min(open, close) - spreadBase * (0.45 + random()))
    const volume = Math.round(LARGE_CAP_MIN_VOLUME + random() * (LARGE_CAP_MAX_VOLUME - LARGE_CAP_MIN_VOLUME))

    previousClose = close

    return {
      time,
      open: roundPrice(open),
      high: roundPrice(Math.max(high, open, close)),
      low: roundPrice(Math.min(low, open, close)),
      close: roundPrice(close),
      volume,
    }
  })
}

function normalizeCandles(candles: Candle[]): Candle[] {
  return candles
    .map((candle): Candle | null => {
      const time = normalizeTime(candle.time)
      const open = Number(candle.open)
      const high = Number(candle.high)
      const low = Number(candle.low)
      const close = Number(candle.close)
      const volume = Number(candle.volume ?? 0)
      if (!time || ![open, high, low, close].every(Number.isFinite)) return null

      return {
        time,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      }
    })
    .filter((candle): candle is Candle => candle !== null)
    .sort((a, b) => Number(a.time) - Number(b.time))
}

function normalizeTime(time: Candle['time']): number | null {
  if (typeof time === 'number') {
    return time > 100_000_000_000 ? Math.floor(time / 1000) : time
  }
  const numeric = Number(time)
  if (Number.isFinite(numeric)) {
    return numeric > 100_000_000_000 ? Math.floor(numeric / 1000) : numeric
  }
  const parsed = Date.parse(time)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null
}

function marketTimes(count: number, intervalMinutes: number): number[] {
  const times: number[] = []
  const now = new Date()
  const current = istDateParts(now)
  let cursor: IstDay = current
  let minuteCursor = latestMarketMinute(current.hour * 60 + current.minute, intervalMinutes)

  while (times.length < count) {
    if (isWeekend(cursor.year, cursor.month, cursor.day)) {
      cursor = previousIstDay(cursor)
      minuteCursor = latestMarketMinute(MARKET_CLOSE_MINUTES, intervalMinutes)
      continue
    }

    if (minuteCursor < MARKET_OPEN_MINUTES) {
      cursor = previousIstDay(cursor)
      minuteCursor = latestMarketMinute(MARKET_CLOSE_MINUTES, intervalMinutes)
      continue
    }

    times.push(istEpochSeconds(cursor.year, cursor.month, cursor.day, minuteCursor))

    if (intervalMinutes >= dayMinutes()) {
      cursor = previousIstDay(cursor)
      minuteCursor = MARKET_CLOSE_MINUTES
    } else {
      minuteCursor -= intervalMinutes
    }
  }

  return times.reverse()
}

function timeframeToMinutes(timeframe: string): number {
  const normalized = timeframe.trim().toLowerCase()
  if (normalized === 'd' || normalized === '1d') return dayMinutes()
  if (normalized.endsWith('h')) return Number.parseInt(normalized, 10) * 60 || 60
  if (normalized.endsWith('m')) return Number.parseInt(normalized, 10) || 5
  return 5
}

function dayMinutes() {
  return MARKET_CLOSE_MINUTES - MARKET_OPEN_MINUTES
}

function latestMarketMinute(currentMinute: number, intervalMinutes: number) {
  const capped = Math.min(Math.max(currentMinute, MARKET_OPEN_MINUTES), MARKET_CLOSE_MINUTES)
  if (intervalMinutes >= dayMinutes()) return MARKET_CLOSE_MINUTES
  const elapsed = Math.max(0, capped - MARKET_OPEN_MINUTES)
  return MARKET_OPEN_MINUTES + Math.floor(elapsed / intervalMinutes) * intervalMinutes
}

function istDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  }
}

interface IstDay {
  year: number
  month: number
  day: number
}

function previousIstDay(date: IstDay): IstDay {
  const utcMs = Date.UTC(date.year, date.month - 1, date.day, 0, 0) - 24 * 60 * 60 * 1000
  const previous = new Date(utcMs)
  return {
    year: previous.getUTCFullYear(),
    month: previous.getUTCMonth() + 1,
    day: previous.getUTCDate(),
  }
}

function isWeekend(year: number, month: number, day: number) {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 || weekday === 6
}

function istEpochSeconds(year: number, month: number, day: number, minutes: number) {
  const utcMs = Date.UTC(year, month - 1, day, 0, minutes - IST_OFFSET_MINUTES)
  return Math.floor(utcMs / 1000)
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

function hashSymbol(value: string) {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0
  }, 2166136261)
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100
}
