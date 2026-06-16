'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

interface TickerStock {
  symbol: string;
  name: string;
  ltp: number;
  change: number;
  changePct: number;
}

/**
 * Scrolling top-of-landing-page ticker. Pulls the 20-stock snapshot
 * from /api/market/overview and refreshes every 15s (60s when the tab
 * is hidden). Triples the array for a seamless infinite scroll.
 */
export function LiveTicker() {
  const [stocks, setStocks] = useState<TickerStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch(`${API}/api/market/overview`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStocks(data.stocks || []);
      } catch (e) {
        console.error('Ticker fetch failed:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
    const applyInterval = () => {
      const delay = document.hidden ? 60000 : 15000;
      return setInterval(fetchStocks, delay);
    };
    const id = applyInterval();
    const onVisibility = () => {
      clearInterval(id);
      const fresh = applyInterval();
      // Re-assign to id so cleanup gets the right one
      Object.assign(id, fresh);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (loading && stocks.length === 0) {
    return (
      <div
        className="h-8 border-b flex items-center px-4 text-xs font-mono"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderBottomColor: 'var(--border)',
          color: 'var(--text-2)',
        }}
      >
        Loading market data...
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div
        className="h-8 border-b flex items-center px-4 text-xs font-mono"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderBottomColor: 'var(--border)',
          color: 'var(--text-2)',
        }}
      >
        Market data temporarily unavailable
      </div>
    );
  }

  // Triple the list for seamless looping; the CSS animation translates
  // by -33.33% (one full copy's width).
  const displayStocks = [...stocks, ...stocks, ...stocks];

  return (
    <div
      className="h-8 border-b overflow-hidden relative"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderBottomColor: 'var(--border)',
      }}
    >
      <div className="ticker-track flex items-center h-full gap-8 whitespace-nowrap font-mono text-[12px]">
        {displayStocks.map((s, i) => (
          <div key={`${s.symbol}-${i}`} className="flex items-center gap-2">
            <span style={{ color: 'var(--text-0)' }} className="font-medium">
              {s.symbol}
            </span>
            <span style={{ color: 'var(--text-1)' }}>
              ₹{(s.ltp ?? 0).toFixed(2)}
            </span>
            <span
              className="flex items-center gap-0.5"
              style={{ color: s.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {s.changePct >= 0 ? (
                <TrendingUp size={10} />
              ) : (
                <TrendingDown size={10} />
              )}
              {s.changePct >= 0 ? '+' : ''}
              {(s.changePct ?? 0).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
      <style jsx>{`
        .ticker-track {
          animation: scroll-left 90s linear infinite;
        }
        @keyframes scroll-left {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-33.33%);
          }
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
