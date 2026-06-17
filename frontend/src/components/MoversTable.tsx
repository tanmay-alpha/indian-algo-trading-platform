'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

type Tab = 'gainers' | 'losers' | 'active' | '52w_high' | '52w_low';
const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'gainers', label: 'Gainers', Icon: TrendingUp },
  { id: 'losers', label: 'Losers', Icon: TrendingDown },
  { id: 'active', label: 'Most Active', Icon: BarChart2 },
  { id: '52w_high', label: '52W High', Icon: TrendingUp },
  { id: '52w_low', label: '52W Low', Icon: TrendingDown },
];

interface MoverStock {
  symbol: string;
  name: string;
  sector: string;
  ltp: number;
  change: number;
  changePct: number;
  volume: number;
}

/**
 * Tabbed movers table for the markets hub. Tabs hit /api/market/movers
 * with different `direction` values; the table stays in sync with the
 * backend as data updates (every 60s while visible).
 */
export function MoversTable() {
  const [tab, setTab] = useState<Tab>('gainers');
  const [stocks, setStocks] = useState<MoverStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    fetch(`${API}/api/market/movers?direction=${tab}&limit=25`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStocks(d.stocks || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div
      className="border rounded overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="flex border-b overflow-x-auto"
        style={{ borderBottomColor: 'var(--border)' }}
      >
        {TABS.map((t) => {
          const Icon = t.Icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2"
              style={{
                backgroundColor: isActive ? 'var(--bg-2)' : 'transparent',
                color: isActive ? 'var(--text-0)' : 'var(--text-1)',
                borderBottom: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-[10px] uppercase"
              style={{
                color: 'var(--text-2)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <th className="text-left p-3 font-medium">Symbol</th>
              <th className="text-left p-3 font-medium">Sector</th>
              <th className="text-right p-3 font-medium">LTP</th>
              <th className="text-right p-3 font-medium">Change</th>
              <th className="text-right p-3 font-medium">% Chg</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="p-3">
                      <div
                        className="h-3 rounded animate-pulse"
                        style={{ backgroundColor: 'var(--bg-2)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : stocks.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-sm"
                  style={{ color: 'var(--text-2)' }}
                >
                  No data available. Yahoo may be rate-limiting — try again in
                  a minute.
                </td>
              </tr>
            ) : (
              stocks.map((s, i) => (
                <tr
                  key={s.symbol + i}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <td className="p-3">
                    <Link
                      href={`/stocks/${encodeURIComponent(s.symbol)}`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {s.symbol}
                    </Link>
                    <div
                      className="text-[11px]"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {s.name}
                    </div>
                  </td>
                  <td
                    className="p-3 text-[11px]"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {s.sector}
                  </td>
                  <td className="p-3 text-right font-mono">
                    ₹{(s.ltp ?? 0).toFixed(2)}
                  </td>
                  <td
                    className="p-3 text-right font-mono"
                    style={{
                      color:
                        s.change >= 0 ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {s.change >= 0 ? '+' : ''}
                    {(s.change ?? 0).toFixed(2)}
                  </td>
                  <td
                    className="p-3 text-right font-mono font-medium"
                    style={{
                      color:
                        s.changePct >= 0 ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {s.changePct >= 0 ? '+' : ''}
                    {(s.changePct ?? 0).toFixed(2)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
