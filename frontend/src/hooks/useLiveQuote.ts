'use client';
import { useEffect, useState, useRef, useCallback } from 'react';

interface Quote {
  symbol: string;
  ltp: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

/**
 * Poll a single symbol's quote from the backend at a steady cadence.
 * Pauses (×6) when the tab is hidden so we don't burn Render CPU while
 * the user has the page in the background.
 */
export function useLiveQuote(symbol: string, refreshMs = 5000) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/quote/${symbol}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQuote(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchQuote();
    const applyInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const delay = document.hidden ? refreshMs * 6 : refreshMs;
      intervalRef.current = setInterval(fetchQuote, delay);
    };
    applyInterval();
    const onVisibility = () => applyInterval();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchQuote, refreshMs]);

  return { quote, loading, error, refetch: fetchQuote };
}

/**
 * Bulk-poll a list of symbols in a single POST to /api/quotes/bulk.
 * Much cheaper than N parallel useLiveQuote calls.
 */
export function useLiveQuotes(symbols: string[], refreshMs = 5000) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const symbolsKey = symbols.join(',');

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      const res = await fetch(`${API}/api/quotes/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQuotes(data.quotes || {});
    } catch (e) {
      console.error('Bulk fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
    const applyInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const delay = document.hidden ? refreshMs * 6 : refreshMs;
      intervalRef.current = setInterval(fetchAll, delay);
    };
    applyInterval();
    const onVisibility = () => applyInterval();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAll, refreshMs]);

  return { quotes, loading, refetch: fetchAll };
}
