'use client';

import { Building2, MapPin, Users, Calendar } from 'lucide-react';
import type { StockFundamentals } from '@/hooks/useStockDetail';

interface Props {
  fundamentals: StockFundamentals | null;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(2) + '%';
}

export function CompanyOverview({ fundamentals }: Props) {
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
        Company information unavailable.
      </section>
    );
  }

  const f = fundamentals;
  const stats: { label: string; value: string }[] = [
    { label: 'Sector', value: f.sector || '—' },
    { label: 'Industry', value: f.industry || '—' },
    { label: '52W Range', value: `${fmtNum(f['52wLow'])} – ${fmtNum(f['52wHigh'])}` },
    { label: '50D Avg', value: fmtNum(f['50dAvg']) },
    { label: '200D Avg', value: fmtNum(f['200dAvg']) },
    { label: 'Beta', value: fmtNum(f.beta) },
    { label: 'P/E (TTM)', value: fmtNum(f.pe) },
    { label: 'P/B', value: fmtNum(f.pb) },
    { label: 'ROE', value: fmtPct(f.roe) },
    { label: 'Debt/Equity', value: fmtNum(f.debtToEquity, 2) },
  ];

  return (
    <section
      className="border rounded p-6"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Company overview"
    >
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={14} style={{ color: 'var(--gold)' }} />
        <h2
          className="text-[11px] uppercase tracking-wider font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Company Overview
        </h2>
      </div>

      <h3
        className="text-2xl font-display font-semibold mb-2"
        style={{ color: 'var(--text-0)' }}
      >
        {f.name}
      </h3>
      <div
        className="text-sm mb-4"
        style={{ color: 'var(--text-1)' }}
      >
        {f.sector}
        {f.industry ? ` · ${f.industry}` : ''}
      </div>

      <p
        className="text-sm leading-relaxed mb-6"
        style={{ color: 'var(--text-1)' }}
      >
        {f.name} is listed on the National Stock Exchange (NSE) and Bombay
        Stock Exchange (BSE). The company is classified under the{' '}
        <span style={{ color: 'var(--text-0)' }}>{f.sector}</span> sector
        {f.industry ? (
          <>
            {' '}and operates in the{' '}
            <span style={{ color: 'var(--text-0)' }}>{f.industry}</span> space
          </>
        ) : null}
        . Fundamental data on this page is sourced from Yahoo Finance and
        refreshed once per hour.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-6 gap-y-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div
              className="text-[10px] uppercase tracking-wider font-mono mb-1"
              style={{ color: 'var(--text-2)' }}
            >
              {s.label}
            </div>
            <div
              className="font-mono text-sm tabular-nums"
              style={{ color: 'var(--text-0)' }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
