import type {
  AIChatResponse,
  CandlesResponse,
  Funds,
  FundsResponse,
  Holding,
  HoldingsResponse,
  InstrumentSearchResult,
  InstrumentSearchResponse,
  OHLCV,
  PendingSignalsResponse,
  Position,
  PositionsResponse,
  Signal,
  SignalHistoryResponse,
  Strategy,
  StrategyConfig,
  StrategyTemplate,
  StrategyTemplatesResponse,
} from '@/types/market';

// Backend base URL. In the browser we go through the same-origin /api/proxy
// route so the Next.js server side-steps CORS and TLS for us. The proxy
// forwards to BACKEND_URL or falls back to localhost:8000. On the server
// (SSR) we hit the backend directly.
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

// All admin-token handling lives in the server-side /api/proxy route
// (frontend/app/api/proxy/[...path]/route.ts), which reads ADMIN_TOKEN
// from server-only env vars. The browser bundle never sees the token.
async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${REST_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: Json, init?: RequestInit): Promise<T> {
  const res = await fetch(`${REST_BASE}${path}`, {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

// --- Search & instruments ---

export const searchSymbol = async (q: string): Promise<InstrumentSearchResult[]> => {
  const res = await apiGet<InstrumentSearchResponse>(
    `/instruments/search?q=${encodeURIComponent(q)}&limit=20`
  );
  return Array.isArray(res?.results) ? res.results : [];
};

// --- OHLCV ---
// Backend wraps candles in {candles: [...], count, source, ...}; the UI
// wants a flat array, so unwrap here.
export const getOHLCV = async (
  symbol: string,
  interval: string,
  limit = 300,
  fetchFromBroker = false
): Promise<OHLCV[]> => {
  const res = await apiGet<CandlesResponse>(
    `/candles/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(
      interval
    )}&limit=${limit}${fetchFromBroker ? '&fetch=true' : ''}`
  );
  return Array.isArray(res?.candles) ? res.candles : [];
};

// --- Portfolio (read-only via broker/account/*) ---
// Returns BROKER_SESSION_UNAVAILABLE-shaped responses (with empty arrays) when
// no Angel One session is connected — the UI treats that as "no data yet".

export const getHoldings = async (): Promise<Holding[]> => {
  const res = await apiGet<HoldingsResponse>(`/broker/account/holdings`);
  if (res?.status !== 'OK') return [];
  return Array.isArray(res.holdings) ? res.holdings : [];
};

export const getPositions = async (): Promise<Position[]> => {
  const res = await apiGet<PositionsResponse>(`/broker/account/positions`);
  if (res?.status !== 'OK') return [];
  return Array.isArray(res.positions) ? res.positions : [];
};

export const getFunds = async (): Promise<Funds | null> => {
  const res = await apiGet<FundsResponse>(`/broker/account/funds`);
  if (res?.status !== 'OK') return null;
  return res.funds ?? null;
};

// --- Strategies ---
// Two flavours: runtime configs (admin) and templates (public). The UI
// surfaces both.

export const getStrategies = async (): Promise<Strategy[]> => {
  const res = await apiGet<StrategyConfig[] | { configs: StrategyConfig[] }>(
    `/strategies/configs`
  );
  const list = Array.isArray(res)
    ? res
    : Array.isArray((res as { configs?: StrategyConfig[] })?.configs)
      ? (res as { configs: StrategyConfig[] }).configs
      : [];
  return list.map((c) => ({
    id: String(c.id ?? c.strategy_name ?? ''),
    name: c.display_name ?? c.strategy_name ?? `Strategy ${c.id ?? ''}`,
    type: (c.strategy_name ?? 'CUSTOM') as Strategy['type'],
    status: c.status ?? 'DRAFT',
    lastSignal: c.last_signal_at ?? c.updated_at ?? undefined,
  }));
};

export const getStrategyTemplates = async (): Promise<StrategyTemplate[]> => {
  const res = await apiGet<StrategyTemplatesResponse>(`/strategies/templates`);
  return Array.isArray(res?.templates) ? res.templates : [];
};

// --- Signals ---

// `side` from the backend is lowercase 'buy'/'sell' but our UI types use the
// uppercase 'BUY'/'SELL' SignalAction enum — normalize here.
function normalizeSignal(raw: {
  id: number | string;
  strategy_id: number | string;
  symbol: string;
  side?: string;
  action?: string;
  price: number;
  created_at?: string;
  timestamp?: string;
  status: string;
}): Signal {
  const side = (raw.action ?? raw.side ?? '').toString().toUpperCase();
  return {
    id: String(raw.id),
    strategyId: String(raw.strategy_id),
    symbol: raw.symbol,
    action: side === 'SELL' ? 'SELL' : 'BUY',
    price: Number(raw.price ?? 0),
    timestamp: raw.timestamp ?? raw.created_at ?? new Date().toISOString(),
    status: (() => {
      const s = (raw.status ?? '').toString().toUpperCase();
      if (s === 'APPROVED' || s === 'APPROVE_PAPER' || s === 'EXECUTED') return 'APPROVED';
      if (s === 'REJECTED' || s === 'DISMISSED') return 'REJECTED';
      return 'PENDING';
    })(),
  };
}

export const getSignals = async (): Promise<Signal[]> => {
  const res = await apiGet<SignalHistoryResponse>(`/strategies/signals/history?limit=50`);
  const list = Array.isArray(res?.signals) ? res.signals : [];
  return list.map(normalizeSignal);
};

export const getPendingSignals = async (): Promise<Signal[]> => {
  const res = await apiGet<PendingSignalsResponse>(`/strategies/signals/pending`);
  const list = Array.isArray(res?.signals) ? res.signals : [];
  return list.map(normalizeSignal);
};

export const approveSignal = (id: string): Promise<unknown> =>
  apiPost(`/strategies/signals/${encodeURIComponent(id)}/approve-paper`, {});

export const rejectSignal = (id: string): Promise<unknown> =>
  apiPost(`/strategies/signals/${encodeURIComponent(id)}/dismiss`, {});

// --- Backtest ---

type BacktestRequestBody = {
  strategy_name: string;
  symbol: string;
  from: string;
  to: string;
  timeframe?: string;
  initial_capital?: number;
  quantity?: number;
};

export const runBacktest = (
  strategy: string,
  symbol: string,
  from: string,
  to: string
): Promise<unknown> =>
  apiPost('/strategies/backtest', {
    strategy_name: strategy,
    symbol,
    from,
    to,
    timeframe: '1d',
    initial_capital: 100_000,
    quantity: 1,
  } satisfies BacktestRequestBody);

// --- AI chat ---
// The backend doesn't currently expose an /ai/chat endpoint; the AI panel
// keeps an optimistic stub here that resolves with a friendly message so
// the UI doesn't break. When the real endpoint ships, swap this body.
export const sendAIChat = async (
  message: string,
  context: Record<string, unknown>
): Promise<AIChatResponse> => {
  // Best-effort: try a few likely backend paths. If none resolve, fall back
  // to a deterministic local explanation so the panel stays useful.
  const candidates = ['/ai/chat', '/assistant/chat', '/llm/chat'];
  for (const path of candidates) {
    try {
      const res = await apiPost<{ response?: string }>(path, { message, context });
      if (res && typeof res.response === 'string') {
        return { response: res.response };
      }
    } catch {
      // try next
    }
  }
  const sym = typeof context.symbol === 'string' && context.symbol
    ? ` for ${context.symbol}`
    : '';
  return {
    response: `[Local stub] AI backend is not configured. You asked: "${message}".${sym ? ` Active symbol${sym}.` : ''}`,
  };
};

export { wsBase, BACKEND };
