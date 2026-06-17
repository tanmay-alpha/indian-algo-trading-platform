'use client';
import { ChevronUp, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ScreenerResult } from '@/lib/screener';

interface Props {
  stocks: ScreenerResult[];
  loading: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

interface Column {
  key: string;
  label: string;
  align?: 'right' | 'left';
}

const COLUMNS: Column[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'sector', label: 'Sector' },
  { key: 'ltp', label: 'LTP', align: 'right' },
  { key: 'changePct', label: '% Chg', align: 'right' },
  { key: 'marketCap', label: 'Mkt Cap (Cr)', align: 'right' },
  { key: 'pe', label: 'P/E', align: 'right' },
  { key: 'pb', label: 'P/B', align: 'right' },
  { key: 'roe', label: 'ROE %', align: 'right' },
  { key: 'dividendYield', label: 'Div %', align: 'right' },
  { key: 'debtToEquity', label: 'D/E', align: 'right' },
];

function fmt(key: string, val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return '—';
  switch (key) {
    case 'ltp':
      return `₹${n.toFixed(2)}`;
    case 'changePct':
      return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    case 'marketCap':
      // Yahoo marketCap is in INR (raw). Display in Cr.
      return `₹${(n / 1e7).toFixed(0)}`;
    case 'roe':
    case 'dividendYield':
      return `${n.toFixed(1)}%`;
    case 'pb':
    case 'debtToEquity':
      return n.toFixed(2);
    case 'pe':
      return n.toFixed(1);
    default:
      return String(val);
  }
}

function changeColor(val: unknown): string {
  if (val == null) return 'var(--text-1)';
  const n = Number(val);
  if (Number.isNaN(n)) return 'var(--text-1)';
  return n >= 0 ? 'var(--green)' : 'var(--red)';
}

export function ScreenerTable({
  stocks,
  loading,
  sortBy,
  sortDir,
  onSort,
}: Props) {
  if (loading) {
    return (
      <div
        className="border rounded p-12 flex flex-col items-center gap-3"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderColor: 'var(--border)',
        }}
      >
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
        <div className="text-sm" style={{ color: 'var(--text-1)' }}>
          Running screener...
        </div>
        <div
          className="text-xs"
          style={{ color: 'var(--text-2)' }}
        >
          Fetching fundamentals from Yahoo (cached after first run)
        </div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div
        className="border rounded p-12 text-center"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="text-sm" style={{ color: 'var(--text-2)' }}>
          No stocks match your filters
        </div>
        <div
          className="text-xs mt-2"
          style={{ color: 'var(--text-2)' }}
        >
          Try removing some filters or pick a preset
        </div>
      </div>
    );
  }

  return (
    <div
      className="border rounded overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{
                backgroundColor: 'var(--bg-2)',
                borderBottomColor: 'var(--border)',
              }}
            >
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className="p-3 text-[10px] mono uppercase tracking-wider font-medium cursor-pointer hover:text-[var(--text-0)] whitespace-nowrap"
                  style={{
                    color:
                      sortBy === col.key
                        ? 'var(--text-0)'
                        : 'var(--text-2)',
                    textAlign: col.align === 'right' ? 'right' : 'left',
                  }}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      col.align === 'right' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {col.label}
                    {sortBy === col.key &&
                      (sortDir === 'asc' ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </span>
                </th>
              ))}
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr
                key={s.symbol}
                className="border-b hover:bg-[var(--bg-2)]"
                style={{ borderBottomColor: 'var(--border)' }}
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
                    className="text-[10px] mt-0.5"
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
                <td className="p-3 text-right font-mono text-[12px]">
                  {fmt('ltp', s.ltp)}
                </td>
                <td
                  className="p-3 text-right font-mono text-[12px] font-medium"
                  style={{ color: changeColor(s.changePct) }}
                >
                  {fmt('changePct', s.changePct)}
                </td>
                <td
                  className="p-3 text-right font-mono text-[12px]"
                  style={{ color: 'var(--text-1)' }}
                >
                  {fmt('marketCap', s.marketCap)}
                </td>
                <td className="p-3 text-right font-mono text-[12px]">
                  {fmt('pe', s.pe)}
                </td>
                <td className="p-3 text-right font-mono text-[12px]">
                  {fmt('pb', s.pb)}
                </td>
                <td className="p-3 text-right font-mono text-[12px]">
                  {fmt('roe', s.roe)}
                </td>
                <td className="p-3 text-right font-mono text-[12px]">
                  {fmt('dividendYield', s.dividendYield)}
                </td>
                <td className="p-3 text-right font-mono text-[12px]">
                  {fmt('debtToEquity', s.debtToEquity)}
                </td>
                <td className="p-3 text-right">
                  <Link
                    href={`/stocks/${encodeURIComponent(s.symbol)}`}
                    className="hover:text-[var(--accent)]"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <ExternalLink size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="p-3 border-t text-[10px] font-mono flex justify-between"
        style={{
          borderTopColor: 'var(--border)',
          color: 'var(--text-2)',
        }}
      >
        <span>Showing {stocks.length} stocks</span>
        <span>
          Sort: {sortBy} ({sortDir})
        </span>
      </div>
    </div>
  );
}
