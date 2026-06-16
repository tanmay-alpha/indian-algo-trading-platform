'use client';

import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Loader2, ExternalLink } from 'lucide-react';
import type {
  MarketStatus,
  StockFundamentals,
  StockQuote,
} from '@/hooks/useStockDetail';

interface Props {
  symbol: string;
  quote: StockQuote | null;
  fundamentals: StockFundamentals | null;
  marketStatus: MarketStatus | null;
  loading: boolean;
  error: string | null;
  rightAction?: ReactNode;
}

function formatIN(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInr(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatVolume(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
  return String(n);
}

function formatMcap(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return '—';
  // Yahoo returns marketCap in INR for NSE symbols. We show Cr (1e7) and L (1e5).
  if (n >= 1e12) return '₹' + (n / 1e12).toFixed(2) + ' L Cr';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}

export function StockHeader({
  symbol,
  quote,
  fundamentals,
  marketStatus,
  loading,
  error,
  rightAction,
}: Props) {
  const name = fundamentals?.name ?? symbol;
  const sector = fundamentals?.sector ?? '—';
  const industry = fundamentals?.industry ?? '';
  const isUp = quote ? quote.change >= 0 : false;
  const changeColor = isUp ? 'var(--green)' : 'var(--red)';
  const marketOpen = marketStatus?.isOpen ?? false;

  return (
    <header
      className="border rounded p-6 md:p-8"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Top row: breadcrumb + market status pill */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono"
             style={{ color: 'var(--text-2)' }}>
          <a href="/markets" className="hover:underline" style={{ color: 'var(--text-1)' }}>
            Markets
          </a>
          <span>›</span>
          <span style={{ color: 'var(--gold)' }}>{symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: marketOpen ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.10)',
              color: marketOpen ? 'var(--green)' : 'var(--red)',
            }}
          >
            {marketStatus?.session ?? (marketOpen ? 'OPEN' : 'CLOSED')}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: 'var(--text-2)' }}>
            NSE · BSE
          </span>
        </div>
        {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
      </div>

      {/* Title block: company name + symbol */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1
            className="font-display font-semibold leading-tight"
            style={{
              color: 'var(--text-0)',
              fontSize: 'clamp(28px, 4vw, 40px)',
              letterSpacing: '-0.02em',
            }}
          >
            {name}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              className="text-sm font-mono font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--bg-2)',
                color: 'var(--gold)',
              }}
            >
              {symbol}
            </span>
            {sector !== '—' && (
              <span className="text-xs" style={{ color: 'var(--text-1)' }}>
                {sector}
                {industry ? ` · ${industry}` : ''}
              </span>
            )}
            {fundamentals && (
              <a
                href={`https://www.bseindia.com/stock-share-price/${symbol}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] inline-flex items-center gap-1 hover:underline"
                style={{ color: 'var(--text-2)' }}
              >
                BSE page <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>

        {loading && !quote && (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-2)' }}
          >
            <Loader2 size={14} className="animate-spin" /> Loading quote...
          </div>
        )}
      </div>

      {/* Quote: large LTP + change + side arrow */}
      {quote && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider font-mono mb-1"
              style={{ color: 'var(--text-2)' }}
            >
              Last Traded Price
            </div>
            <div className="flex items-baseline gap-3">
              <span
                className="font-mono font-semibold tabular-nums"
                style={{
                  color: 'var(--text-0)',
                  fontSize: 'clamp(36px, 5vw, 56px)',
                  lineHeight: 1,
                }}
              >
                {formatInr(quote.ltp)}
              </span>
              {isUp ? (
                <TrendingUp size={28} style={{ color: changeColor }} />
              ) : (
                <TrendingDown size={28} style={{ color: changeColor }} />
              )}
            </div>
            <div
              className="flex items-baseline gap-2 mt-2 font-mono tabular-nums"
              style={{ color: changeColor, fontSize: 18 }}
            >
              <span>
                {quote.change >= 0 ? '+' : '−'}
                {formatIN(Math.abs(quote.change))}
              </span>
              <span>
                ({quote.changePct >= 0 ? '+' : '−'}
                {formatIN(Math.abs(quote.changePct))}%)
              </span>
            </div>
            {error && (
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-2)' }}>
                {error}
              </div>
            )}
          </div>

          {/* Compact quote table — BSE-style */}
          <div className="md:col-span-2">
            <QuoteGrid quote={quote} />
          </div>
        </div>
      )}
    </header>
  );
}

function QuoteGrid({ quote }: { quote: StockQuote }) {
  const rows: { label: string; value: string; color?: string }[] = [
    { label: 'Open', value: formatInr(quote.open) },
    { label: 'Prev Close', value: formatInr(quote.close) },
    {
      label: "Day's High",
      value: formatInr(quote.high),
      color: 'var(--green)',
    },
    {
      label: "Day's Low",
      value: formatInr(quote.low),
      color: 'var(--red)',
    },
    { label: 'Volume', value: formatVolume(quote.volume) },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-3 p-4 border rounded"
      style={{
        backgroundColor: 'var(--bg-0)',
        borderColor: 'var(--border)',
      }}
    >
      {rows.map((r) => (
        <div key={r.label}>
          <div
            className="text-[10px] uppercase tracking-wider font-mono mb-0.5"
            style={{ color: 'var(--text-2)' }}
          >
            {r.label}
          </div>
          <div
            className="font-mono text-sm tabular-nums"
            style={{ color: r.color ?? 'var(--text-0)' }}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}
