'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';

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

type Props = {
  className?: string;
};

export function WatchlistPanel({ className }: Props) {
  const [query, setQuery] = useState('');

  const filtered = DEFAULT_ITEMS.filter((item) =>
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

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-[#5F6B7A]">
            No matches
          </li>
        ) : (
          filtered.map((item) => (
            <li
              key={item.symbol}
              className="group flex cursor-pointer items-center justify-between border-b border-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
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
                <span className="font-mono text-[12px] text-[#5F6B7A]">—</span>
                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#5F6B7A]">
                  NO FEED
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
