'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useQuotes } from '@/hooks/useQuotes';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Quote } from '@/types/market';

type WatchlistItem = {
  symbol: string;
  company: string;
};

const DEFAULT_ITEMS: WatchlistItem[] = [
  { symbol: 'RELIANCE', company: 'Reliance Industries' },
  { symbol: 'SBIN', company: 'State Bank of India' },
  { symbol: 'HDFCBANK', company: 'HDFC Bank' },
  { symbol: 'INFY', company: 'Infosys' },
  { symbol: 'TCS', company: 'Tata Consultancy Services' },
];

const FLASH_DURATION_MS = 400;

type Props = {
  className?: string;
};

function formatLtp(quote: Quote | undefined): string {
  if (!quote) return '—';
  if (!Number.isFinite(quote.ltp)) return '—';
  return quote.ltp.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChangePct(quote: Quote | undefined): string {
  if (!quote) return '';
  const pct = quote.changePct;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

const PRICE_FLASH_KEYFRAMES = `@keyframes priceFlash { 0%, 100% { background: transparent } 50% { background: rgba(255,230,0,0.15) } }`;

export function WatchlistPanel({ className }: Props) {
  const [query, setQuery] = useState('');
  const symbols = DEFAULT_ITEMS.map((i) => i.symbol);

  // REST fallback for initial state and fallback
  const { quotes: restQuotes, loading, error } = useQuotes(symbols);
  // Live ticks from WebSocket (these override REST when present)
  const { quotes: wsQuotes, connected } = useWebSocket(symbols);

  // Merge: REST provides initial state, WS updates override on tick
  const mergedQuotes = useMemo(() => {
    const out: Record<string, Quote> = { ...restQuotes };
    for (const symbol in wsQuotes) {
      out[symbol] = wsQuotes[symbol];
    }
    return out;
  }, [restQuotes, wsQuotes]);

  // Per-symbol flash state: when a row's LTP changes, briefly apply the
  // .price-flash class so the user can see live updates.
  const lastLtpRef = useRef<Record<string, number | undefined>>({});
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updated: Record<string, boolean> = {};
    let anyChange = false;
    for (const sym of symbols) {
      const q = mergedQuotes[sym];
      const newLtp = q?.ltp;
      const prevLtp = lastLtpRef.current[sym];
      if (newLtp !== undefined && prevLtp !== undefined && newLtp !== prevLtp) {
        updated[sym] = true;
        anyChange = true;
      }
      lastLtpRef.current[sym] = newLtp;
    }
    if (!anyChange) return;
    setFlashing((prev) => ({ ...prev, ...updated }));
    const timeoutIds = Object.keys(updated).map((sym) =>
      window.setTimeout(() => {
        setFlashing((prev) => {
          if (!prev[sym]) return prev;
          const next = { ...prev };
          delete next[sym];
          return next;
        });
      }, FLASH_DURATION_MS)
    );
    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [mergedQuotes, symbols]);

  const filtered = DEFAULT_ITEMS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(query.toLowerCase()) ||
      item.company.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section
      className={
        'flex h-full min-h-0 w-full flex-col border-r border-[rgba(0,212,255,0.08)] bg-[#0A1020] ' +
        (className ?? '')
      }
      aria-label="Watchlist"
    >
      <style jsx>{PRICE_FLASH_KEYFRAMES}</style>
      <style jsx>{`
        .price-flash {
          animation: priceFlash 400ms ease-out;
        }
      `}</style>

      <header className="flex items-center justify-between border-b border-[rgba(0,212,255,0.08)] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#00D4FF]">
          WATCHLIST
        </span>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-[#5F6B7A] transition-colors hover:bg-white/[0.04] hover:text-[#A0A8B8]"
          aria-label="Add symbol"
        >
          <Plus size={14} />
        </button>
      </header>

      <div className="px-3 py-2">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B7A]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NSE/BSE..."
            className="w-full rounded-md border border-[rgba(0,212,255,0.15)] bg-[#0A1020] py-2 pl-8 pr-3 text-sm text-white placeholder:text-[#5F6B7A] focus:border-[#00D4FF] focus:outline-none"
          />
        </div>
      </div>

      {error && !loading && (
        <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#F59E0B]">
          Feed error · retrying
        </div>
      )}

      {connected && (
        <div className="px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-[#10B981]">
          Live
        </div>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-[#5F6B7A]">
            No matches
          </li>
        ) : (
          filtered.map((item) => {
            const quote = mergedQuotes[item.symbol];
            const isFlashing = flashing[item.symbol] === true;
            const pct = quote?.changePct;
            const pctClass =
              pct === undefined
                ? 'text-[#5F6B7A]'
                : pct > 0
                ? 'text-[#10B981]'
                : pct < 0
                ? 'text-[#EF4444]'
                : 'text-[#5F6B7A]';
            return (
              <li
                key={item.symbol}
                className={
                  'group flex cursor-pointer items-center justify-between border-b border-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.03] ' +
                  (isFlashing ? 'price-flash' : '')
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-white">
                    {item.symbol}
                  </div>
                  <div className="truncate text-[11px] text-[#5F6B7A]">
                    {item.company}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="min-w-[60px] text-right font-mono text-[14px] text-white">
                    {formatLtp(quote)}
                  </span>
                  <span
                    className={
                      'min-w-[54px] text-right font-mono text-[12px] ' + pctClass
                    }
                  >
                    {quote ? formatChangePct(quote) : ''}
                  </span>
                  {!quote && (
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#5F6B7A]">
                      NO FEED
                    </span>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
