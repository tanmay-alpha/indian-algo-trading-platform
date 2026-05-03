import { API_URL, ENDPOINTS } from './constants'
import type {
  HealthResponse,
  Instrument,
  TerminalStatus,
  IndexSnapshot,
  Candle,
  MarketWatchRow,
} from './types'

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    })
  } catch {
    throw new APIError('Backend unreachable', 0)
  }
  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      /* ignore */
    }
    throw new APIError(`HTTP ${res.status}`, res.status, detail)
  }
  return res.json() as Promise<T>
}

// ----- Health / Status -----
export const fetchHealth = () => request<HealthResponse>(ENDPOINTS.health)

export const fetchTerminalStatus = () =>
  request<TerminalStatus>(ENDPOINTS.terminalStatus)

// ----- Instruments / Indices -----
export interface InstrumentsSearchResponse {
  query: string
  results: Instrument[]
}

export async function searchInstruments(q: string): Promise<Instrument[]> {
  if (!q || q.trim().length < 2) return []
  const data = await request<InstrumentsSearchResponse>(
    `${ENDPOINTS.searchInstruments}?q=${encodeURIComponent(q.trim())}`
  )
  return data.results || []
}

export interface IndicesResponse {
  indices: IndexSnapshot[]
}

export async function fetchIndices(): Promise<IndexSnapshot[]> {
  const data = await request<IndicesResponse>(ENDPOINTS.indices)
  return data.indices || []
}

// ----- Market Watch -----
export interface MarketWatchResponse {
  symbols: string[]
  items: MarketWatchRow[]
}

export const fetchMarketWatch = () =>
  request<MarketWatchResponse>(ENDPOINTS.marketWatch)

export const setMarketWatch = (symbols: string[]) =>
  request<MarketWatchResponse>(ENDPOINTS.marketWatch, {
    method: 'POST',
    body: JSON.stringify({ symbols }),
  })

// ----- Candles -----
export const fetchCandles = (symbol: string, interval = '5m') =>
  request<{ symbol: string; interval: string; candles: Candle[] }>(
    `${ENDPOINTS.candles}/${encodeURIComponent(symbol)}?interval=${interval}`
  )
