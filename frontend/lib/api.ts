import { API_URL, ENDPOINTS } from './constants'
import type { HealthResponse, Instrument, IndexData } from './types'

class APIError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(errorData.detail || `HTTP ${response.status}`, response.status)
    }

    return response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError('Network error - API server may be offline', 0)
  }
}

// API Functions
export async function fetchHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>(ENDPOINTS.health)
}

export async function fetchTerminalStatus(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>(ENDPOINTS.terminalStatus)
}

export async function searchInstruments(query: string): Promise<Instrument[]> {
  if (!query || query.length < 2) return []
  return fetchAPI<Instrument[]>(`${ENDPOINTS.searchInstruments}?q=${encodeURIComponent(query)}`)
}

export async function fetchIndices(): Promise<IndexData[]> {
  return fetchAPI<IndexData[]>(ENDPOINTS.indices)
}

export async function fetchMarketWatch(): Promise<unknown> {
  return fetchAPI(ENDPOINTS.marketWatch)
}

export async function toggleExecutionMode(mode: 'PAPER' | 'LIVE'): Promise<{ status: string; new_mode: string }> {
  return fetchAPI(`${ENDPOINTS.toggleMode}?mode=${mode}`, { method: 'POST' })
}

export async function toggleAutoPilot(): Promise<{ status: string; auto_pilot: boolean }> {
  return fetchAPI(ENDPOINTS.toggleAutoPilot, { method: 'POST' })
}

export async function placeOrder(
  side: 'BUY' | 'SELL',
  qty: number,
  symbol: string = 'SBIN-EQ'
): Promise<{ status: string; reason?: string; error?: string }> {
  return fetchAPI(`${ENDPOINTS.order}?side=${side}&qty=${qty}&symbol=${encodeURIComponent(symbol)}`, {
    method: 'POST',
  })
}
