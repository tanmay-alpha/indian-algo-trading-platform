'use client';

import { useEffect, useRef, useState } from 'react';

export interface StockQuote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp?: string;
}

export interface StockFundamentals {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  pe: number | null;
  forward_pe: number | null;
  pb: number | null;
  ps: number | null;
  ev_ebitda: number | null;
  peg: number | null;
  marketCap: number;
  enterpriseValue: number;
  beta: number;
  roe: number | null;
  roa: number | null;
  roce: number | null;
  profitMargin: number | null;
  debtToEquity: number;
  currentRatio: number | null;
  quickRatio: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  trailingAnnualDividendYield: number | null;
  '52wHigh': number | null;
  '52wLow': number | null;
  '50dAvg': number | null;
  '200dAvg': number | null;
  avgVolume: number;
  avgVolume10d: number;
  volume: number;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
}

export interface MarketStatus {
  isOpen: boolean;
  now: string;
  session: 'OPEN' | 'CLOSED';
}

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

/**
 * Fetch all data needed for the stock detail page in parallel:
 *   - Live quote (refreshed on interval)
 *   - Fundamentals (Yahoo, cached 1h on backend)
 *   - Market status (open/closed)
 *
 * Returns a single state object so the page can show a unified loader and
 * render partial UI as each piece resolves.
 */
export function useStockDetail(symbol: string, refreshMs = 6000) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [fundamentals, setFundamentals] = useState<StockFundamentals | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling quote (cheap)
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const fetchQuote = async () => {
      try {
        const res = await fetch(`${API}/api/quote/${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StockQuote;
        if (!cancelled) {
          setQuote(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message ?? 'quote fetch failed');
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    };

    fetchQuote();
    const applyInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const delay = typeof document !== 'undefined' && document.hidden
        ? refreshMs * 6
        : refreshMs;
      intervalRef.current = setInterval(fetchQuote, delay);
    };
    applyInterval();
    const onVisibility = () => applyInterval();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [symbol, refreshMs]);

  // One-shot fundamentals (Yahoo, slow but cached)
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setFundamentalsLoading(true);
    fetch(`${API}/api/fundamentals/${encodeURIComponent(symbol)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setFundamentals(d as StockFundamentals);
      })
      .catch((e) => {
        if (!cancelled) {
          // Fundamentals are best-effort — don't fail the page if Yahoo 503s.
          setFundamentals(null);
          setError((prev) => prev ?? (e as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setFundamentalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Market status (cheap, refresh every minute)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const fetchStatus = () => {
      fetch(`${API}/api/market/status`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setMarketStatus(d as MarketStatus);
        })
        .catch(() => {
          if (!cancelled) {
            setMarketStatus({ isOpen: false, now: new Date().toISOString(), session: 'CLOSED' });
          }
        });
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return {
    quote,
    fundamentals,
    marketStatus,
    quoteLoading,
    fundamentalsLoading,
    error,
  };
}
