'use client';

import { useEffect, useRef, useState } from 'react';
import { getQuote } from '@/services/angelone';
import type { Quote } from '@/types/market';

const POLL_INTERVAL_MS = 3000;
const SCHEDULE_TICK_MS = 30_000;

export type UseQuotesResult = {
  quotes: Record<string, Quote>;
  loading: boolean;
  error: string | null;
};

function isMarketOpenIST(now: Date): boolean {
  const day = now.getUTCDay();
  // Convert to IST weekday (UTC + 5:30). Weekday indices: Sun=0, Mon=1..Sat=6.
  const istShiftMs = (5 * 60 + 30) * 60_000;
  const ist = new Date(now.getTime() + istShiftMs);
  const weekday = ist.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

export function useQuotes(symbols: string[]): UseQuotesResult {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable key so the effect only re-runs when the symbol set identity changes.
  const symbolsKey = symbols.slice().sort().join(',');

  // Use a ref to access the latest symbol list inside async fetchers.
  const symbolsRef = useRef<string[]>(symbols);
  symbolsRef.current = symbols;

  // A monotonic counter so we can ignore late responses from prior fetches
  // after the symbols change.
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let pollId: number | null = null;
    let inFlight = false;
    const seqAtMount = ++fetchSeqRef.current;

    const fetchAll = async () => {
      if (cancelled || inFlight) return;
      const list = symbolsRef.current;
      if (list.length === 0) {
        setLoading(false);
        return;
      }
      inFlight = true;
      const mySeq = fetchSeqRef.current;
      try {
        const results = await Promise.allSettled(list.map((sym) => getQuote(sym)));
        if (cancelled || mySeq !== fetchSeqRef.current) return;

        setQuotes((prev) => {
          const next: Record<string, Quote> = { ...prev };
          let firstError: string | null = null;
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
              next[list[i]] = r.value;
            } else if (!firstError) {
              firstError =
                r.reason instanceof Error ? r.reason.message : String(r.reason);
            }
          });
          return next;
        });
        setError((prev) => {
          let firstError: string | null = null;
          results.forEach((r) => {
            if (r.status === 'rejected' && !firstError) {
              firstError =
                r.reason instanceof Error ? r.reason.message : String(r.reason);
            }
          });
          return firstError ?? null;
        });
        setLoading(false);
      } finally {
        inFlight = false;
      }
    };

    const clearPoll = () => {
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const startPoll = () => {
      clearPoll();
      pollId = window.setInterval(() => {
        void fetchAll();
      }, POLL_INTERVAL_MS);
    };

    const evaluateSchedule = () => {
      if (cancelled) return;
      if (isMarketOpenIST(new Date())) {
        if (pollId === null) startPoll();
      } else {
        clearPoll();
      }
    };

    // Initial fetch — runs once regardless of market hours.
    void fetchAll();
    evaluateSchedule();
    const scheduleTicker = window.setInterval(evaluateSchedule, SCHEDULE_TICK_MS);

    return () => {
      cancelled = true;
      clearPoll();
      window.clearInterval(scheduleTicker);
      // Touch seqAtMount so the linter doesn't flag it as unused;
      // the value itself only matters for the closure binding.
      void seqAtMount;
    };
  }, [symbolsKey]);

  return { quotes, loading, error };
}
