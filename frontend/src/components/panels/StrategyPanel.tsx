'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  approveSignal,
  getPendingSignals,
  getSignals,
  getStrategies,
  rejectSignal,
} from '@/services/angelone';
import type {
  Signal,
  SignalAction,
  Strategy,
  StrategyStatus,
  StrategyType,
} from '@/types/market';
import { PanelPulseStyles } from './PanelPulseStyles';

type Props = { className?: string };

const STRATEGY_TYPE_COLOR: Record<StrategyType, string> = {
  EMA: '#00D4FF',
  RSI: '#10B981',
  VWAP: '#F59E0B',
  MACD: '#A855F7',
  CUSTOM: '#5F6B7A',
};

const STRATEGY_STATUS_COLOR: Record<
  StrategyStatus,
  { border: string; text: string }
> = {
  ACTIVE: { border: '#10B981', text: '#10B981' },
  PAUSED: { border: '#F59E0B', text: '#F59E0B' },
  DRAFT: { border: '#5F6B7A', text: '#5F6B7A' },
};

const SIGNAL_REFRESH_MS = 10_000;
const PENDING_REFRESH_MS = 5_000;

function formatTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function StrategyPanel({ className }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const [pending, setPending] = useState<Signal[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    setStrategiesError(null);
    try {
      const data = await getStrategies();
      setStrategies(Array.isArray(data) ? data : []);
    } catch (err) {
      setStrategiesError(
        err instanceof Error ? err.message : 'Failed to load strategies'
      );
      setStrategies([]);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      const data = await getSignals();
      setSignals(Array.isArray(data) ? data : []);
    } catch {
      setSignals([]);
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const data = await getPendingSignals();
      setPending(Array.isArray(data) ? data : []);
    } catch {
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
    fetchSignals();
    fetchPending();
  }, [fetchStrategies, fetchSignals, fetchPending]);

  // Polling
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchSignals();
    }, SIGNAL_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchSignals]);

  useEffect(() => {
    const id = window.setInterval(() => {
      fetchPending();
    }, PENDING_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchPending]);

  const handleApprove = useCallback(
    async (id: string) => {
      setActing(id);
      try {
        await approveSignal(id);
        await fetchPending();
      } catch {
        // Surface via re-render; the list will stay as-is on failure.
      } finally {
        setActing(null);
      }
    },
    [fetchPending]
  );

  const handleReject = useCallback(
    async (id: string) => {
      setActing(id);
      try {
        await rejectSignal(id);
        await fetchPending();
      } catch {
        // ignore
      } finally {
        setActing(null);
      }
    },
    [fetchPending]
  );

  const recentSignals = signals.slice(0, 5);

  return (
    <section
      className={
        'flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto bg-[#050812] p-4 ' +
        (className ?? '')
      }
      aria-label="Strategy"
    >
      {/* Paper-mode banner */}
      <div
        className="flex shrink-0 items-center rounded-md border px-3.5 py-2 font-mono text-[12px]"
        style={{
          background: 'rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.2)',
          color: '#F59E0B',
        }}
      >
        <span aria-hidden="true">⚡</span>
        <span className="ml-2">
          Paper signals only · Live trading gate disabled
        </span>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* CARD 1 — STRATEGIES (span 2) */}
        <div
          className="rounded-lg border bg-[#0A1020] p-4 md:col-span-2"
          style={{ borderColor: 'rgba(0,212,255,0.08)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="font-mono text-[10px] uppercase tracking-wider text-[#00D4FF]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              STRATEGIES
            </h2>
            <button
              type="button"
              onClick={fetchStrategies}
              disabled={strategiesLoading}
              aria-label="Refresh strategies"
              className="rounded p-1 text-[#5F6B7A] transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={strategiesLoading ? 'animate-spin' : ''}
              />
            </button>
          </div>

          {strategiesLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 w-full rounded"
                  style={{
                    background: 'rgba(0,212,255,0.08)',
                    animation: `panelPulse 1.5s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : strategiesError ? (
            <p className="py-6 text-center text-[12px] text-[#EF4444]">
              {strategiesError}
            </p>
          ) : strategies.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#5F6B7A]">
              No strategies configured
            </p>
          ) : (
            <ul className="flex flex-col">
              {strategies.map((s) => {
                const typeColor = STRATEGY_TYPE_COLOR[s.type];
                const status = STRATEGY_STATUS_COLOR[s.status];
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between border-b border-white/[0.04] py-2.5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="truncate text-[13px] font-medium text-white"
                        style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                      >
                        {s.name}
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          borderColor: typeColor,
                          color: typeColor,
                          background: 'transparent',
                        }}
                      >
                        {s.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          borderColor: status.border,
                          color: status.text,
                          background: 'transparent',
                        }}
                      >
                        {s.status}
                      </span>
                      <span
                        className="font-mono text-[11px] tabular-nums text-[#5F6B7A]"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {s.lastSignal
                          ? `Last signal: ${formatTime(s.lastSignal)} IST`
                          : 'No signal yet'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* CARD 2 — SIGNAL FEED (span 1) */}
        <div
          className="rounded-lg border bg-[#0A1020] p-4 md:col-span-1"
          style={{ borderColor: 'rgba(0,212,255,0.08)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="font-mono text-[10px] uppercase tracking-wider text-[#00D4FF]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              SIGNAL FEED
            </h2>
            <span
              className="font-mono text-[10px] text-[#5F6B7A]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              10s
            </span>
          </div>

          {signalsLoading && recentSignals.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-9 w-full rounded"
                  style={{
                    background: 'rgba(0,212,255,0.08)',
                    animation: `panelPulse 1.5s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : recentSignals.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[#5F6B7A]">
              No signals yet
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recentSignals.map((sig) => {
                const isBuy = sig.action === 'BUY';
                const color = isBuy ? '#10B981' : '#EF4444';
                const bg = isBuy
                  ? 'rgba(16,185,129,0.15)'
                  : 'rgba(239,68,68,0.15)';
                return (
                  <li
                    key={sig.id}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                      style={{
                        borderColor: color,
                        color,
                        background: bg,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {sig.action}
                    </span>
                    <span
                      className="truncate text-[12px] text-white"
                      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                    >
                      {sig.symbol}
                    </span>
                    <span
                      className="ml-auto font-mono text-[10px] tabular-nums text-[#5F6B7A]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatTime(sig.timestamp)} IST
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* CARD 3 — PENDING APPROVALS (span 3) */}
        <div
          className="rounded-lg border bg-[#0A1020] p-4 md:col-span-3"
          style={{ borderColor: 'rgba(0,212,255,0.08)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: '#F59E0B',
              }}
            >
              PENDING SIGNALS — PAPER APPROVAL
            </h2>
            <span
              className="font-mono text-[10px] text-[#5F6B7A]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              5s · {pending.length}
            </span>
          </div>

          {pendingLoading && pending.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-8 w-full rounded"
                  style={{
                    background: 'rgba(0,212,255,0.08)',
                    animation: `panelPulse 1.5s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{ minHeight: 60 }}
            >
              <p className="text-center text-[13px] text-[#5F6B7A]">
                No pending signals
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr
                    className="font-mono text-[10px] uppercase tracking-wider text-[#5F6B7A]"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <th className="py-2 pr-3 font-normal">Action</th>
                    <th className="py-2 pr-3 font-normal">Symbol</th>
                    <th className="py-2 pr-3 font-normal">Price</th>
                    <th className="py-2 pr-3 font-normal">Strategy</th>
                    <th className="py-2 pr-3 font-normal">Time</th>
                    <th className="py-2 pr-0 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => {
                    const isBuy: boolean = p.action === ('BUY' as SignalAction);
                    const color = isBuy ? '#10B981' : '#EF4444';
                    const bg = isBuy
                      ? 'rgba(16,185,129,0.15)'
                      : 'rgba(239,68,68,0.15)';
                    const busy = acting === p.id;
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-white/[0.04]"
                      >
                        <td className="py-2 pr-3">
                          <span
                            className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                            style={{
                              borderColor: color,
                              color,
                              background: bg,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {p.action}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-white">
                          {p.symbol}
                        </td>
                        <td
                          className="py-2 pr-3 font-mono tabular-nums text-white"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          ₹{p.price.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2 pr-3 text-[#A0A8B8]">
                          {p.strategyId}
                        </td>
                        <td
                          className="py-2 pr-3 font-mono tabular-nums text-[#5F6B7A]"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {formatTime(p.timestamp)} IST
                        </td>
                        <td className="py-2 pr-0">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(p.id)}
                              disabled={busy}
                              className="rounded border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50"
                              style={{
                                background: 'rgba(16,185,129,0.1)',
                                borderColor: '#10B981',
                                color: '#10B981',
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(p.id)}
                              disabled={busy}
                              className="rounded border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50"
                              style={{
                                background: 'rgba(239,68,68,0.1)',
                                borderColor: '#EF4444',
                                color: '#EF4444',
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <PanelPulseStyles />
    </section>
  );
}
