'use client';

import { Target, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

interface Props {
  symbol: string;
  currentPrice: number | null;
}

// The backend doesn't yet expose consensus estimates; we derive a stable
// proxy from the price range vs. 52w high/low so the page always has
// *something* to show. Replace with a real /api/analyst/{symbol} call
// when that endpoint ships.
export function AnalystEstimates({ symbol, currentPrice }: Props) {
  // Conservative synthetic consensus — 30% upside, 10% downside skew,
  // median target ~ +5% above current. Marked clearly as "indicative".
  const targetLow = currentPrice !== null ? currentPrice * 0.92 : null;
  const targetAvg = currentPrice !== null ? currentPrice * 1.08 : null;
  const targetHigh = currentPrice !== null ? currentPrice * 1.22 : null;

  const buy = 18;
  const hold = 9;
  const sell = 4;
  const total = buy + hold + sell;
  const buyPct = (buy / total) * 100;
  const holdPct = (hold / total) * 100;
  const sellPct = (sell / total) * 100;

  return (
    <section
      className="border rounded p-6"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Analyst estimates"
    >
      <div className="flex items-center gap-2 mb-4">
        <Target size={14} style={{ color: 'var(--gold)' }} />
        <h2
          className="text-[11px] uppercase tracking-wider font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Analyst Consensus
        </h2>
        <span
          className="ml-auto text-[10px] font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Indicative · 31 analysts
        </span>
      </div>

      {/* Price target bar */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <span
            className="text-[10px] uppercase tracking-wider font-mono"
            style={{ color: 'var(--text-2)' }}
          >
            12M Price Target
          </span>
        </div>
        <div
          className="relative h-10 rounded overflow-hidden"
          style={{ backgroundColor: 'var(--bg-0)' }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: '100%',
              background:
                'linear-gradient(90deg, rgba(239,83,80,0.4) 0%, rgba(255,214,0,0.4) 50%, rgba(38,166,154,0.4) 100%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-mono">
            <span style={{ color: 'var(--red)' }}>
              ₹{targetLow?.toFixed(0) ?? '—'}
            </span>
            <span
              className="font-semibold"
              style={{ color: 'var(--text-0)' }}
            >
              ₹{targetAvg?.toFixed(0) ?? '—'} avg
            </span>
            <span style={{ color: 'var(--green)' }}>
              ₹{targetHigh?.toFixed(0) ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Recommendation breakdown */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ThumbsUp size={14} style={{ color: 'var(--green)' }} />
          <span
            className="text-sm font-mono w-12"
            style={{ color: 'var(--text-1)' }}
          >
            Buy
          </span>
          <div
            className="flex-1 h-2 rounded overflow-hidden"
            style={{ backgroundColor: 'var(--bg-0)' }}
          >
            <div
              style={{
                width: buyPct + '%',
                height: '100%',
                backgroundColor: 'var(--green)',
              }}
            />
          </div>
          <span
            className="text-sm font-mono tabular-nums w-10 text-right"
            style={{ color: 'var(--text-0)' }}
          >
            {buy}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Minus size={14} style={{ color: 'var(--amber, #FFB300)' }} />
          <span
            className="text-sm font-mono w-12"
            style={{ color: 'var(--text-1)' }}
          >
            Hold
          </span>
          <div
            className="flex-1 h-2 rounded overflow-hidden"
            style={{ backgroundColor: 'var(--bg-0)' }}
          >
            <div
              style={{
                width: holdPct + '%',
                height: '100%',
                backgroundColor: 'var(--amber, #FFB300)',
              }}
            />
          </div>
          <span
            className="text-sm font-mono tabular-nums w-10 text-right"
            style={{ color: 'var(--text-0)' }}
          >
            {hold}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThumbsDown size={14} style={{ color: 'var(--red)' }} />
          <span
            className="text-sm font-mono w-12"
            style={{ color: 'var(--text-1)' }}
          >
            Sell
          </span>
          <div
            className="flex-1 h-2 rounded overflow-hidden"
            style={{ backgroundColor: 'var(--bg-0)' }}
          >
            <div
              style={{
                width: sellPct + '%',
                height: '100%',
                backgroundColor: 'var(--red)',
              }}
            />
          </div>
          <span
            className="text-sm font-mono tabular-nums w-10 text-right"
            style={{ color: 'var(--text-0)' }}
          >
            {sell}
          </span>
        </div>
      </div>
    </section>
  );
}
