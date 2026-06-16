'use client';

import { useState, useEffect } from 'react';
import { Star, StarOff } from 'lucide-react';

export function AddToWatchlistButton({ symbol }: { symbol: string }) {
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    const list = localStorage.getItem('maet_watchlist');
    setInWatchlist(Boolean(list?.includes(symbol.toUpperCase())));
  }, [symbol]);

  const handleClick = () => {
    const list = JSON.parse(localStorage.getItem('maet_watchlist') || '[]');
    const sym = symbol.toUpperCase();
    let next: string[];
    if (list.includes(sym)) {
      next = list.filter((s: string) => s !== sym);
      setInWatchlist(false);
    } else {
      next = [...list, sym];
      setInWatchlist(true);
    }
    localStorage.setItem('maet_watchlist', JSON.stringify(next));
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        inWatchlist
          ? 'bg-[var(--accent)] text-[var(--bg-0)] hover:bg-[var(--accent)]/90'
          : 'bg-[var(--bg-2)] text-[var(--text-1)] hover:bg-[var(--bg-3)] border border-[var(--border)]'
      }`}
      style={{
        boxShadow: inWatchlist
          ? '0 2px 8px rgba(41, 98, 255, 0.3)'
          : 'none',
      }}
    >
      {inWatchlist ? (
        <>
          <Star size={14} fill="currentColor" />
          <span>Remove</span>
        </>
      ) : (
        <>
          <StarOff size={14} />
          <span>Add to Watchlist</span>
        </>
      )}
    </button>
  );
}
