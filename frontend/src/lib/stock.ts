/**
 * Stock detail API client (Prompt 5).
 *
 * Wraps the new /api/stocks/{symbol}/* endpoints: info, peers, news, financials.
 * Falls back to empty shapes on network errors so the UI degrades gracefully.
 */

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  marketCap: number;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  beta: number | null;
  '52wHigh': number | null;
  '52wLow': number | null;
  pctFrom52wHigh: number | null;
  pctFrom52wLow: number | null;
  avgVolume: number | null;
}

export interface PeerStock {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  pe: number | null;
  roe: number | null;
  ltp?: number | null;
  changePct?: number | null;
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  published: string | null;
  snippet: string;
}

export interface FinancialPeriod {
  period: string;
  lineItems: Record<string, number | null>;
}

export interface Financials {
  symbol: string;
  exchange: string;
  quarterly: {
    income: FinancialPeriod[];
    balance: FinancialPeriod[];
    cashflow: FinancialPeriod[];
  };
  annual: {
    income: FinancialPeriod[];
    balance: FinancialPeriod[];
    cashflow: FinancialPeriod[];
  };
}

const SYMBOL_RE = /^[A-Z0-9&\-]{1,20}$/;

function validateSymbol(symbol: string): string {
  const upper = (symbol || '').toUpperCase();
  if (!SYMBOL_RE.test(upper)) {
    throw new Error(`Invalid symbol: ${symbol}`);
  }
  return upper;
}

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getStockInfo(symbol: string): Promise<StockInfo | null> {
  const sym = validateSymbol(symbol);
  try {
    const r = await fetch(`${API}/api/stocks/${sym}/info`, {
      cache: 'no-store',
    });
    return await safeJson<StockInfo>(r, null as unknown as StockInfo);
  } catch {
    return null;
  }
}

export async function getStockPeers(
  symbol: string,
  limit = 6,
): Promise<PeerStock[]> {
  const sym = validateSymbol(symbol);
  try {
    const r = await fetch(
      `${API}/api/stocks/${sym}/peers?limit=${limit}`,
      { cache: 'no-store' },
    );
    const d = await safeJson<{ peers: PeerStock[] }>(r, { peers: [] });
    return d.peers || [];
  } catch {
    return [];
  }
}

export async function getStockNews(
  symbol: string,
  name?: string,
  limit = 10,
): Promise<NewsArticle[]> {
  const sym = validateSymbol(symbol);
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (name) params.set('name', name);
    const r = await fetch(
      `${API}/api/stocks/${sym}/news?${params.toString()}`,
      { cache: 'no-store' },
    );
    const d = await safeJson<{ articles: NewsArticle[] }>(
      r,
      { articles: [] },
    );
    return d.articles || [];
  } catch {
    return [];
  }
}

export async function getStockFinancials(
  symbol: string,
): Promise<Financials | null> {
  const sym = validateSymbol(symbol);
  try {
    const r = await fetch(`${API}/api/stocks/${sym}/financials`, {
      cache: 'no-store',
    });
    return await safeJson<Financials>(r, null as unknown as Financials);
  } catch {
    return null;
  }
}
