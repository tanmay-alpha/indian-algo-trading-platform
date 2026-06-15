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

// Backend base URL. In the browser we go through the same-origin /api/proxy
// route so the Next.js server side-steps CORS and TLS for us. The proxy
// forwards to NEXT_PUBLIC_BACKEND_URL or falls back to localhost:8000.
// On the server (SSR) we hit the backend directly.
const PROXY_PATH = '/api/proxy';
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '') || '';

const isServer = typeof window === 'undefined';
const REST_BASE = isServer ? BACKEND : PROXY_PATH;

function wsBase(): string {
  // Browser WebSockets can't be proxied by the Next.js route handler, so we
  // connect directly. Use NEXT_PUBLIC_WS_URL if set, otherwise derive from the
  // REST backend URL. Empty string = WS disabled (the hook will simply stay
  // disconnected and the REST poll keeps the UI alive).
  if (typeof window === 'undefined') return '';
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (BACKEND) return BACKEND.replace(/^http/i, 'ws');
  return '';
}

type Json = Record<string, unknown> | unknown[] | null;

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${REST_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: Json): Promise<T> {
  const res = await fetch(`${REST_BASE}${path}`, {
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

export { wsBase, BACKEND };
