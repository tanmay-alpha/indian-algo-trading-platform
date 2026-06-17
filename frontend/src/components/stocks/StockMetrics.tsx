'use client';

import { Loader2 } from 'lucide-react';
import type { StockFundamentals } from '@/hooks/useStockDetail';

interface Props {
  fundamentals: StockFundamentals | null;
  loading: boolean;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits) + '%';
}

function fmtInrCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return '—';
  if (n >= 1e12) return '₹' + (n / 1e12).toFixed(2) + ' L Cr';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}

function fmtVolume(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return '—';
  if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
  return String(n);
}

type Metric = {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
};

export function StockMetrics({ fundamentals, loading }: Props) {
  if (loading && !fundamentals) {
    return (
      <section
        className="border rounded p-6 flex items-center gap-2 text-sm"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderColor: 'var(--border)',
          color: 'var(--text-2)',
        }}
      >
        <Loader2 size={14} className="animate-spin" /> Loading fundamentals from
        Yahoo...
      </section>
    );
  }

  if (!fundamentals) {
    return (
      <section
        className="border rounded p-6 text-sm"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderColor: 'var(--border)',
          color: 'var(--text-2)',
        }}
      >
        Fundamentals unavailable for this symbol.
      </section>
    );
  }

  const f = fundamentals;
  const metrics: Metric[] = [
    // Market
    { label: 'Market Cap', value: fmtInrCompact(f.marketCap) },
    { label: 'Enterprise Value', value: fmtInrCompact(f.enterpriseValue) },
    { label: '52W High', value: fmtNum(f['52wHigh']) },
    { label: '52W Low', value: fmtNum(f['52wLow']) },
    // Valuation
    { label: 'P/E (TTM)', value: fmtNum(f.pe) },
    { label: 'Forward P/E', value: fmtNum(f.forward_pe) },
    { label: 'P/B', value: fmtNum(f.pb) },
    { label: 'EV/EBITDA', value: fmtNum(f.ev_ebitda) },
    // Returns
    {
      label: 'ROE',
      value: fmtPct(f.roe),
      positive: (f.roe ?? 0) >= 15,
    },
    {
      label: 'ROA',
      value: fmtPct(f.roa),
      positive: (f.roa ?? 0) >= 5,
    },
    { label: 'Profit Margin', value: fmtPct(f.profitMargin) },
    { label: 'Beta', value: fmtNum(f.beta) },
    // Dividends
    { label: 'Dividend Yield', value: fmtPct(f.dividendYield) },
    { label: 'Payout Ratio', value: fmtPct(f.payoutRatio) },
    // Volume
    { label: 'Avg Volume (10d)', value: fmtVolume(f.avgVolume10d) },
    { label: 'Avg Volume', value: fmtVolume(f.avgVolume) },
    // Growth
    {
      label: 'Revenue Growth',
      value: fmtPct(f.revenueGrowth),
      positive: (f.revenueGrowth ?? 0) >= 0,
    },
    {
      label: 'Earnings Growth',
      value: fmtPct(f.earningsGrowth),
      positive: (f.earningsGrowth ?? 0) >= 0,
    },
  ];

  return (
    <section
      className="border rounded p-6"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Key metrics"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="text-[11px] uppercase tracking-wider font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Key Metrics
        </h2>
        <span
          className="text-[10px] font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Source: Yahoo Finance
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-4">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider font-mono mb-1 truncate"
              style={{ color: 'var(--text-2)' }}
              title={m.label}
            >
              {m.label}
            </div>
            <div
              className="font-mono text-sm tabular-nums"
              style={{
                color:
                  m.positive === true
                    ? 'var(--green)'
                    : m.positive === false
                      ? 'var(--red)'
                      : 'var(--text-0)',
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
