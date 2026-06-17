'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StockFundamentals } from '@/hooks/useStockDetail';

interface Props {
  fundamentals: StockFundamentals | null;
}

function fmtInrCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return '—';
  if (n >= 1e12) return '₹' + (n / 1e12).toFixed(2) + ' L Cr';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
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

function GrowthCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span style={{ color: 'var(--text-2)' }}>—</span>;
  }
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  return (
    <span
      className="inline-flex items-center gap-1 font-mono"
      style={{
        color: isUp ? 'var(--green)' : isDown ? 'var(--red)' : 'var(--text-2)',
      }}
    >
      <Icon size={12} />
      {fmtPct(Math.abs(value))}
    </span>
  );
}

export function FinancialsTable({ fundamentals }: Props) {
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
        Financial data unavailable.
      </section>
    );
  }

  const f = fundamentals;
  const rows: { label: string; value: string; growth?: number | null }[] = [
    { label: 'Revenue Growth (YoY)', value: '—', growth: f.revenueGrowth },
    { label: 'Earnings Growth (YoY)', value: '—', growth: f.earningsGrowth },
    { label: 'Profit Margin', value: fmtPct(f.profitMargin) },
    { label: 'Return on Equity (ROE)', value: fmtPct(f.roe) },
    { label: 'Return on Assets (ROA)', value: fmtPct(f.roa) },
    { label: 'Debt to Equity', value: fmtNum(f.debtToEquity, 2) },
    { label: 'Current Ratio', value: fmtNum(f.currentRatio, 2) },
    { label: 'Quick Ratio', value: fmtNum(f.quickRatio, 2) },
    { label: 'Market Cap', value: fmtInrCompact(f.marketCap) },
    { label: 'Enterprise Value', value: fmtInrCompact(f.enterpriseValue) },
    { label: 'P/E (TTM)', value: fmtNum(f.pe) },
    { label: 'Forward P/E', value: fmtNum(f.forward_pe) },
    { label: 'P/B', value: fmtNum(f.pb) },
    { label: 'P/S', value: fmtNum(f.ps) },
    { label: 'EV/EBITDA', value: fmtNum(f.ev_ebitda) },
    { label: 'PEG', value: fmtNum(f.peg) },
    { label: 'Dividend Yield', value: fmtPct(f.dividendYield) },
    { label: 'Payout Ratio', value: fmtPct(f.payoutRatio) },
  ];

  return (
    <section
      className="border rounded p-6"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Key financials"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="text-[11px] uppercase tracking-wider font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Key Financials
        </h2>
        <span
          className="text-[10px] font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          TTM · Yahoo
        </span>
      </div>

      <div
        className="overflow-x-auto"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-0)',
                color: 'var(--text-2)',
              }}
            >
              <th
                scope="col"
                className="text-left font-mono text-[10px] uppercase tracking-wider py-2.5 px-4"
              >
                Metric
              </th>
              <th
                scope="col"
                className="text-right font-mono text-[10px] uppercase tracking-wider py-2.5 px-4"
              >
                Value
              </th>
              <th
                scope="col"
                className="text-right font-mono text-[10px] uppercase tracking-wider py-2.5 px-4"
              >
                YoY Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.label}
                style={{
                  backgroundColor:
                    i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <td
                  className="py-2.5 px-4"
                  style={{ color: 'var(--text-1)' }}
                >
                  {r.label}
                </td>
                <td
                  className="py-2.5 px-4 text-right font-mono tabular-nums"
                  style={{ color: 'var(--text-0)' }}
                >
                  {r.value}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {r.growth !== undefined ? (
                    <GrowthCell value={r.growth} />
                  ) : (
                    <span style={{ color: 'var(--text-2)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
