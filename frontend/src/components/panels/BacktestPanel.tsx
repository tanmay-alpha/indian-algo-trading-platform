'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getStrategies, runBacktest } from '@/services/angelone';
import type { Strategy } from '@/types/market';
import { PanelPulseStyles } from './PanelPulseStyles';

type Props = { className?: string };

type MetricTone = 'pos' | 'neg' | 'neutral';

type EquityPoint = { timestamp: string; equity: number; drawdown: number };

type BacktestMetrics = {
  total_return_pct?: number;
  win_rate?: number;
  max_drawdown?: number;
  total_trades?: number;
  net_pnl?: number;
  sharpe?: number;
  benchmark_return_pct?: number;
  avg_trade_pct?: number;
};

type BacktestResult = {
  status: string;
  equity_curve: EquityPoint[];
  metrics: BacktestMetrics;
  reason?: string | null;
};

const SAMPLE_EQUITY: { ts: string; equity: number }[] = (() => {
  const start = 100_000;
  const end = 124_700;
  const points = 20;
  const out: { ts: string; equity: number }[] = [];
  const startDate = new Date('2025-09-01T00:00:00Z').getTime();
  const step = ((end - start) / (points - 1)) * 1.05;
  for (let i = 0; i < points; i++) {
    // Sample curve with a slight wobble so the line doesn't look perfectly linear.
    const wobble = Math.sin(i * 0.7) * 400 + Math.cos(i * 1.3) * 220;
    const equity = start + (i * (end - start)) / (points - 1) + wobble;
    const ts = new Date(startDate + i * 86_400_000 * 1.5).toISOString();
    out.push({ ts, equity: Math.round(equity) });
  }
  // Force the last sample to land close to `end` (124700).
  if (out.length > 0) {
    const last = out[out.length - 1];
    out[out.length - 1] = { ts: last.ts, equity: end };
  }
  return out;
})();

function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-IN');
}

function toneFor(n: number | null | undefined, baseline: MetricTone): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '#FFFFFF';
  if (baseline === 'pos') return n >= 0 ? '#10B981' : '#EF4444';
  if (baseline === 'neg') return n >= 0 ? '#EF4444' : '#10B981';
  return '#FFFFFF';
}

const labelClass =
  'font-mono text-[10px] uppercase tracking-wider text-[#5F6B7A]';
const valueClass =
  'font-mono text-[32px] leading-none tabular-nums';

export function BacktestPanel({ className }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategyId, setStrategyId] = useState<string>('');
  const [symbol, setSymbol] = useState<string>('');
  const [from, setFrom] = useState<string>('2025-01-01');
  const [to, setTo] = useState<string>('2025-06-01');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStrategies()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setStrategies(list);
        if (list.length > 0 && !strategyId) {
          setStrategyId(list[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setStrategies([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = async () => {
    if (!strategyId || !symbol.trim() || !from || !to) return;
    setRunning(true);
    setError(null);
    try {
      const data = (await runBacktest(strategyId, symbol.trim(), from, to)) as
        | BacktestResult
        | { detail?: string }
        | null;
      if (!data || typeof data !== 'object') {
        throw new Error('Empty backtest response');
      }
      if ('detail' in data && data.detail) {
        throw new Error(String(data.detail));
      }
      if ('status' in data && (data as BacktestResult).status !== 'success') {
        const reason = (data as BacktestResult).reason;
        throw new Error(reason ?? `Backtest ${(data as BacktestResult).status}`);
      }
      setResult(data as BacktestResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Backtest failed'
      );
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    void handleRun();
  };

  const equitySeries = useMemo(() => {
    if (result && Array.isArray(result.equity_curve) && result.equity_curve.length > 0) {
      return result.equity_curve.map((p) => ({
        ts: p.timestamp,
        equity: p.equity,
      }));
    }
    return SAMPLE_EQUITY;
  }, [result]);

  const totalReturn = result?.metrics?.total_return_pct ?? null;
  const benchmark = result?.metrics?.benchmark_return_pct ?? 8.2;
  const sharpe = result?.metrics?.sharpe ?? null;
  const maxDd = result?.metrics?.max_drawdown ?? null;
  const winRate = result?.metrics?.win_rate ?? null;
  const totalTrades = result?.metrics?.total_trades ?? null;
  const avgTrade = result?.metrics?.avg_trade_pct ?? null;

  return (
    <section
      className={
        'flex h-full min-h-0 w-full flex-row gap-4 overflow-y-auto bg-[#050812] p-4 ' +
        (className ?? '')
      }
      aria-label="Backtest"
    >
      {/* LEFT — form */}
      <div
        className="flex shrink-0 flex-col gap-3.5 rounded-lg border p-5"
        style={{
          width: 300,
          background: 'rgba(15,25,41,0.5)',
          backdropFilter: 'blur(8px)',
          borderColor: 'rgba(0,212,255,0.08)',
        }}
      >
        <h2
          className={labelClass}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          RUN BACKTEST
        </h2>

        <Field label="Strategy">
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className="form-input"
          >
            {strategies.length === 0 ? (
              <option value="">No strategies available</option>
            ) : (
              strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type})
                </option>
              ))
            )}
          </select>
        </Field>

        <Field label="Symbol">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. RELIANCE-EQ"
            className="form-input"
          />
        </Field>

        <Field label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="form-input"
          />
        </Field>

        <Field label="To">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="form-input"
          />
        </Field>

        <button
          type="button"
          onClick={handleRun}
          disabled={running || !strategyId || !symbol.trim() || !from || !to}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: '#00D4FF',
            color: '#050812',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontWeight: 600,
          }}
        >
          {running ? (
            <>
              <Spinner /> Running…
            </>
          ) : (
            <>Run Backtest →</>
          )}
        </button>
      </div>

      {/* RIGHT — results */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {running ? (
          <BacktestSkeleton />
        ) : error ? (
          <ErrorCard message={error} onRetry={handleRetry} />
        ) : (
          <>
            {/* Metrics grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              <Metric
                label="TOTAL RETURN"
                value={formatPct(totalReturn)}
                color={toneFor(totalReturn, 'pos')}
                sub={
                  benchmark !== null && totalReturn !== null
                    ? `vs benchmark ${formatPct(benchmark)}`
                    : undefined
                }
              />
              <Metric
                label="SHARPE RATIO"
                value={formatNum(sharpe, 2)}
                color="#FFFFFF"
              />
              <Metric
                label="MAX DRAWDOWN"
                value={formatPct(maxDd)}
                color={toneFor(maxDd, 'neg')}
              />
              <Metric
                label="WIN RATE"
                value={formatPct(winRate)}
                color="#FFFFFF"
              />
              <Metric
                label="TOTAL TRADES"
                value={formatInt(totalTrades)}
                color="#FFFFFF"
              />
              <Metric
                label="AVG TRADE"
                value={formatPct(avgTrade, 2)}
                color={toneFor(avgTrade, 'pos')}
              />
            </div>

            {/* Equity curve */}
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: 'rgba(0,212,255,0.08)',
                background: '#0A1020',
                height: 220,
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className={labelClass} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  EQUITY CURVE
                </h2>
                <span
                  className="font-mono text-[10px] text-[#5F6B7A]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {result ? `${equitySeries.length} points` : 'sample'}
                </span>
              </div>
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={equitySeries}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      stroke="rgba(0,212,255,0.04)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="ts"
                      stroke="#5F6B7A"
                      tick={{ fill: '#5F6B7A', fontSize: 10 }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        if (Number.isNaN(d.getTime())) return v;
                        return d.toLocaleDateString('en-IN', {
                          month: 'short',
                          day: '2-digit',
                        });
                      }}
                      minTickGap={32}
                    />
                    <YAxis
                      stroke="#5F6B7A"
                      tick={{ fill: '#5F6B7A', fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        `₹${(v / 1000).toFixed(0)}k`
                      }
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0F1929',
                        border: '1px solid rgba(0,212,255,0.2)',
                        color: 'white',
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#5F6B7A', fontSize: 11 }}
                      formatter={(v) => {
                        const n =
                          typeof v === 'number'
                            ? v
                            : Number(v ?? Number.NaN);
                        if (!Number.isFinite(n)) return [String(v), 'Equity'];
                        return [
                          `₹${Math.round(n).toLocaleString('en-IN')}`,
                          'Equity',
                        ];
                      }}
                      labelFormatter={(label) => {
                        const text =
                          typeof label === 'string'
                            ? label
                            : label instanceof Date
                              ? label.toISOString()
                              : String(label ?? '');
                        const d = new Date(text);
                        if (Number.isNaN(d.getTime())) return text;
                        return d.toLocaleString('en-IN', {
                          dateStyle: 'medium',
                        });
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke="#00D4FF"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .form-input {
          width: 100%;
          background: #0A1020;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px 10px;
          color: #FFFFFF;
          font-size: 13px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          outline: none;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .form-input:focus {
          border-color: #00D4FF;
          box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.4);
        }
        .form-input::placeholder {
          color: #5F6B7A;
        }
        .form-input[type='date']::-webkit-calendar-picker-indicator {
          filter: invert(60%) sepia(8%) saturate(400%) hue-rotate(180deg);
        }
      `}</style>

      <PanelPulseStyles />
    </section>
  );
}

// ---------- Subcomponents ----------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={labelClass}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: '#0A1020',
        borderColor: 'rgba(0,212,255,0.08)',
      }}
    >
      <div
        className={labelClass}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
      <div
        className={valueClass + ' mt-2'}
        style={{
          color,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value}
      </div>
      {sub ? (
        <div
          className="mt-1.5 text-[11px] text-[#5F6B7A]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#050812] border-t-transparent"
      aria-hidden="true"
    />
  );
}

function BacktestSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 w-full rounded-lg"
            style={{
              background: 'rgba(0,212,255,0.08)',
              animation: `panelPulse 1.5s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>
      <div
        className="h-[200px] w-full rounded-lg"
        style={{
          background: 'rgba(0,212,255,0.08)',
          animation: 'panelPulse 1.5s ease-in-out 0.2s infinite',
        }}
      />
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border p-4"
      style={{
        borderColor: 'rgba(239,68,68,0.4)',
        background: 'rgba(239,68,68,0.06)',
      }}
    >
      <div
        className={labelClass}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: '#EF4444',
        }}
      >
        BACKTEST FAILED
      </div>
      <p
        className="text-[13px] text-white"
        style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border px-3 py-1.5 text-[12px] transition-colors hover:bg-white/[0.04]"
        style={{
          borderColor: 'rgba(0,212,255,0.3)',
          color: '#00D4FF',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        }}
      >
        Try again
      </button>
    </div>
  );
}
