'use client';

import { useState } from 'react';
import { BarChart2 } from 'lucide-react';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D'] as const;
const INDICATORS = ['EMA', 'VWAP', 'RSI', 'MACD', 'BB'] as const;

type Timeframe = (typeof TIMEFRAMES)[number];
type Indicator = (typeof INDICATORS)[number];

type Props = {
  className?: string;
};

export function ChartPanel({ className }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [activeIndicators, setActiveIndicators] = useState<Set<Indicator>>(
    new Set(['EMA', 'VWAP'])
  );

  const toggleIndicator = (ind: Indicator) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) {
        next.delete(ind);
      } else {
        next.add(ind);
      }
      return next;
    });
  };

  return (
    <section
      className={
        'flex h-full min-h-0 w-full flex-col border-r border-[rgba(0,212,255,0.08)] bg-[#0A1020] ' +
        (className ?? '')
      }
      aria-label="Chart"
    >
      <header className="flex flex-col gap-2 border-b border-[rgba(0,212,255,0.08)] px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5F6B7A]">
              Symbol
            </span>
            <span className="text-sm font-semibold text-white">
              Select symbol
            </span>
          </div>

          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={
                    'rounded px-2 py-1 font-mono text-[11px] transition-colors ' +
                    (active
                      ? 'bg-[rgba(0,212,255,0.12)] text-[#00D4FF]'
                      : 'text-[#5F6B7A] hover:bg-white/[0.04] hover:text-[#A0A8B8]')
                  }
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {INDICATORS.map((ind) => {
            const active = activeIndicators.has(ind);
            return (
              <button
                key={ind}
                type="button"
                onClick={() => toggleIndicator(ind)}
                className={
                  'shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ' +
                  (active
                    ? 'border-[rgba(0,212,255,0.4)] bg-[rgba(0,212,255,0.1)] text-[#00D4FF]'
                    : 'border-[rgba(0,212,255,0.08)] text-[#5F6B7A] hover:border-[rgba(0,212,255,0.2)] hover:text-[#A0A8B8]')
                }
              >
                {ind}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart2
            size={48}
            className="text-[#5F6B7A]"
            strokeWidth={1.5}
          />
          <p className="text-sm text-[#5F6B7A]">
            Select a symbol from watchlist
          </p>
        </div>
      </div>
    </section>
  );
}
