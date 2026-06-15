import type {
  AIChatResponse,
  Funds,
  Holding,
  OHLCV,
  Position,
  Quote,
  SearchResponse,
  Signal,
  Strategy,
} from '@/types/market';

const BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '') ||
  'http://localhost:8000';

type Json = Record<string, unknown> | unknown[] | null;

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: Json): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export const getQuote = (symbol: string): Promise<Quote> =>
  apiGet<Quote>(`/api/quote/${encodeURIComponent(symbol)}`);

export const searchSymbol = (q: string): Promise<SearchResponse> =>
  apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);

export const getOHLCV = (
  symbol: string,
  interval: string,
  limit = 300
): Promise<OHLCV[]> =>
  apiGet<OHLCV[]>(
    `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(
      interval
    )}&limit=${limit}`
  );

export const getHoldings = (): Promise<Holding[]> =>
  apiGet<Holding[]>('/api/portfolio/holdings');

export const getPositions = (): Promise<Position[]> =>
  apiGet<Position[]>('/api/portfolio/positions');

export const getFunds = (): Promise<Funds> => apiGet<Funds>('/api/portfolio/funds');

export const getStrategies = (): Promise<Strategy[]> =>
  apiGet<Strategy[]>('/api/strategies');

export const getSignals = (): Promise<Signal[]> => apiGet<Signal[]>('/api/signals');

export const getPendingSignals = (): Promise<Signal[]> =>
  apiGet<Signal[]>('/api/signals/pending');

export const runBacktest = (
  strategy: string,
  symbol: string,
  from: string,
  to: string
): Promise<unknown> =>
  apiPost('/api/backtest', { strategy, symbol, from, to });

export const sendAIChat = (
  message: string,
  context: Record<string, unknown>
): Promise<AIChatResponse> =>
  apiPost<AIChatResponse>('/api/ai/chat', { message, context });

export const approveSignal = (id: string): Promise<unknown> =>
  apiPost(`/api/signals/${encodeURIComponent(id)}/approve`, {});

export const rejectSignal = (id: string): Promise<unknown> =>
  apiPost(`/api/signals/${encodeURIComponent(id)}/reject`, {});

export { BASE };
