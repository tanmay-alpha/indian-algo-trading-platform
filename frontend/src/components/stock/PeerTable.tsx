'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { getStockPeers, type PeerStock } from '@/lib/stock';

interface Props {
  symbol: string;
  limit?: number;
}

export function PeerTable({ symbol, limit = 8 }: Props) {
  const [peers, setPeers] = useState<PeerStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStockPeers(symbol, limit)
      .then((data) => {
        if (!cancelled) setPeers(data);
      })
      .catch((err) => {
        if (!cancelled) console.error('[peers] load failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, limit]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 p-8 text-sm"
        style={{ color: 'var(--text-2)' }}
      >
        <Loader2 size={14} className="animate-spin" /> Loading peers...
      </div>
    );
  }

  if (peers.length === 0) {
    return (
      <div
        className="text-sm p-8 text-center"
        style={{ color: 'var(--text-2)' }}
      >
        No peers found for {symbol}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-[10px] uppercase font-mono tracking-wider"
            style={{
              color: 'var(--text-2)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <th className="text-left p-3 font-medium">Symbol</th>
            <th className="text-left p-3 font-medium">Sector</th>
            <th className="text-right p-3 font-medium">Market Cap</th>
            <th className="text-right p-3 font-medium">P/E</th>
            <th className="text-right p-3 font-medium">ROE</th>
            <th className="text-right p-3 font-medium">P/B</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((p) => (
            <tr
              key={p.symbol}
              className="transition-colors hover:bg-[var(--bg-2)]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <td className="p-3">
                <Link
                  href={`/stocks/${p.symbol}`}
                  className="font-medium hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {p.symbol}
                </Link>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: 'var(--text-2)' }}
                >
                  {p.name}
                </div>
              </td>
              <td
                className="p-3 text-[11px]"
                style={{ color: 'var(--text-1)' }}
              >
                {p.sector}
              </td>
              <td className="p-3 text-right font-mono text-[12px]">
                {formatMcap(p.marketCap)}
              </td>
              <td className="p-3 text-right font-mono text-[12px]">
                {p.pe != null ? p.pe.toFixed(2) : '—'}
              </td>
              <td className="p-3 text-right font-mono text-[12px]">
                {p.roe != null ? `${p.roe.toFixed(1)}%` : '—'}
              </td>
              <td className="p-3 text-right font-mono text-[12px]">
                {/* P/B not always available from fundamentals; show dash */}
                —
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMcap(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) {
    return '—';
  }
  const cr = v / 1e7;
  if (cr >= 100000) return `₹${(cr / 100000).toFixed(2)}L Cr`;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(2)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}
