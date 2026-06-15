'use client';

import { useCallback, useEffect, useState } from 'react';
import { getFunds, getHoldings, getPositions } from '@/services/angelone';
import type { Funds, Holding, Position } from '@/types/market';
import { PanelPulseStyles } from './PanelPulseStyles';

type Props = { className?: string };

const INR = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const fmtNum = (n: number | null | undefined, digits = 2) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtPct = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '';
  return `${arrow} ${sign}${Math.abs(n).toFixed(2)}%`;
};

export function PortfolioPanel({ className }: Props) {
  const [funds, setFunds] = useState<Funds | null>(null);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [fundsError, setFundsError] = useState<string | null>(null);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);

  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const fetchFunds = useCallback(async () => {
    setFundsLoading(true);
    setFundsError(null);
    try {
      const data = await getFunds();
      setFunds(data);
    } catch (err) {
      setFundsError(err instanceof Error ? err.message : 'Failed to load funds');
      setFunds(null);
    } finally {
      setFundsLoading(false);
    }
  }, []);

  const fetchHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    setHoldingsError(null);
    try {
      const data = await getHoldings();
      setHoldings(Array.isArray(data) ? data : []);
    } catch (err) {
      setHoldingsError(
        err instanceof Error ? err.message : 'Failed to load holdings'
      );
      setHoldings([]);
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    setPositionsLoading(true);
    setPositionsError(null);
    try {
      const data = await getPositions();
      setPositions(Array.isArray(data) ? data : []);
    } catch (err) {
      setPositionsError(
        err instanceof Error ? err.message : 'Failed to load positions'
      );
      setPositions([]);
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunds();
    fetchHoldings();
    fetchPositions();
  }, [fetchFunds, fetchHoldings, fetchPositions]);

  return (
    <section
      className={
        'flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto bg-[#050812] p-4 ' +
        (className ?? '')
      }
      aria-label="Portfolio"
    >
      {/* TOP ROW — 4 metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FundCard
          label="PORTFOLIO VALUE"
          value={INR(funds?.totalPortfolioValue)}
          loading={fundsLoading}
          color="#00D4FF"
          error={fundsError}
        />
        <FundCard
          label="AVAILABLE CASH"
          value={INR(funds?.availableCash)}
          loading={fundsLoading}
          color="#FFFFFF"
          error={fundsError}
        />
        <FundCard
          label="USED MARGIN"
          value={INR(funds?.usedMargin)}
          loading={fundsLoading}
          color="#F59E0B"
          error={fundsError}
        />
        <FundCard
          label="FREE MARGIN"
          value={INR(funds?.availableMargin)}
          loading={fundsLoading}
          color="#10B981"
          error={fundsError}
        />
      </div>

      {/* HOLDINGS CARD */}
      <div
        className="rounded-lg border bg-[#0A1020] p-4"
        style={{ borderColor: 'rgba(0,212,255,0.08)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="font-mono text-[10px] uppercase tracking-wider text-[#00D4FF]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            HOLDINGS
          </h2>
          <span
            className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: '#5F6B7A',
              background: 'transparent',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Read-only
          </span>
        </div>

        {holdingsLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 w-full rounded"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  animation: `panelPulse 1.5s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
        ) : holdingsError ? (
          <p className="py-6 text-center text-[12px] text-[#EF4444]">
            {holdingsError}
          </p>
        ) : holdings.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#5F6B7A]">
            No holdings · Connect Angel One account
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-[13px]"
              style={{ tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr
                  className="font-mono text-[10px] uppercase tracking-wider text-[#5F6B7A]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <th className="py-2 pr-2 text-left font-normal">Symbol</th>
                  <th className="py-2 pr-2 text-right font-normal">Qty</th>
                  <th className="py-2 pr-2 text-right font-normal">Avg Price</th>
                  <th className="py-2 pr-2 text-right font-normal">LTP</th>
                  <th className="py-2 pr-2 text-right font-normal">P&amp;L</th>
                  <th className="py-2 pl-2 text-right font-normal">P&amp;L%</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const pnlPos = h.pnl > 0;
                  const pnlNeg = h.pnl < 0;
                  const color = pnlPos ? '#10B981' : pnlNeg ? '#EF4444' : '#FFFFFF';
                  return (
                    <tr
                      key={`${h.tradingSymbol}-${i}`}
                      className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                      style={{
                        background:
                          i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      }}
                    >
                      <td
                        className="py-2 pr-2"
                        style={{
                          fontFamily: "'Space Grotesk', system-ui, sans-serif",
                          fontWeight: 500,
                          color: '#FFFFFF',
                        }}
                      >
                        <div className="truncate">{h.tradingSymbol}</div>
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#FFFFFF',
                        }}
                      >
                        {h.qty.toLocaleString('en-IN')}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#FFFFFF',
                        }}
                      >
                        {fmtNum(h.avgPrice)}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#FFFFFF',
                        }}
                      >
                        {fmtNum(h.ltp)}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color,
                        }}
                      >
                        {INR(h.pnl)}
                      </td>
                      <td
                        className="py-2 pl-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color,
                        }}
                      >
                        {fmtPct(h.pnlPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POSITIONS CARD */}
      <div
        className="rounded-lg border bg-[#0A1020] p-4"
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
            POSITIONS (INTRADAY)
          </h2>
          <span
            className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              borderColor: 'rgba(245,158,11,0.4)',
              color: '#F59E0B',
              background: 'transparent',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Intraday
          </span>
        </div>

        {positionsLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-7 w-full rounded"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  animation: `panelPulse 1.5s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
        ) : positionsError ? (
          <p className="py-6 text-center text-[12px] text-[#EF4444]">
            {positionsError}
          </p>
        ) : positions.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#5F6B7A]">
            No open positions
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-[13px]"
              style={{ tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr
                  className="font-mono text-[10px] uppercase tracking-wider text-[#5F6B7A]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <th className="py-2 pr-2 text-left font-normal">Symbol</th>
                  <th className="py-2 pr-2 text-right font-normal">Net Qty</th>
                  <th className="py-2 pr-2 text-right font-normal">Avg Price</th>
                  <th className="py-2 pr-2 text-right font-normal">LTP</th>
                  <th className="py-2 pr-2 text-right font-normal">P&amp;L</th>
                  <th className="py-2 pr-2 text-right font-normal">Day P&amp;L</th>
                  <th className="py-2 pl-2 text-right font-normal">P&amp;L%</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => {
                  const pnlPos = p.pnl > 0;
                  const pnlNeg = p.pnl < 0;
                  const color = pnlPos ? '#10B981' : pnlNeg ? '#EF4444' : '#FFFFFF';
                  const pct = p.avgPrice > 0 ? (p.pnl / (p.avgPrice * Math.abs(p.netQty))) * 100 : 0;
                  return (
                    <tr
                      key={`${p.symbol}-${i}`}
                      className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                      style={{
                        background:
                          i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      }}
                    >
                      <td
                        className="py-2 pr-2"
                        style={{
                          fontFamily: "'Space Grotesk', system-ui, sans-serif",
                          fontWeight: 500,
                          color: '#FFFFFF',
                        }}
                      >
                        <div className="truncate">{p.symbol}</div>
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#FFFFFF',
                        }}
                      >
                        {p.netQty.toLocaleString('en-IN')}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#FFFFFF',
                        }}
                      >
                        {fmtNum(p.avgPrice)}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#FFFFFF',
                        }}
                      >
                        {fmtNum(p.ltp)}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color,
                        }}
                      >
                        {INR(p.pnl)}
                      </td>
                      <td
                        className="py-2 pr-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color:
                            p.dayPnl > 0
                              ? '#10B981'
                              : p.dayPnl < 0
                                ? '#EF4444'
                                : '#FFFFFF',
                        }}
                      >
                        {INR(p.dayPnl)}
                      </td>
                      <td
                        className="py-2 pl-2 text-right tabular-nums"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color,
                        }}
                      >
                        {fmtPct(pct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PanelPulseStyles />
    </section>
  );
}

function FundCard({
  label,
  value,
  loading,
  color,
  error,
}: {
  label: string;
  value: string;
  loading: boolean;
  color: string;
  error?: string | null;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: 'rgba(15,25,41,0.5)',
        backdropFilter: 'blur(8px)',
        borderColor: 'rgba(0,212,255,0.08)',
      }}
    >
      <div
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color,
        }}
      >
        {label}
      </div>
      <div className="mt-2 min-h-[28px]">
        {loading ? (
          <div
            className="h-7 w-3/4 rounded"
            style={{
              background: 'rgba(0,212,255,0.08)',
              animation: 'panelPulse 1.5s ease-in-out infinite',
            }}
          />
        ) : error ? (
          <div
            className="font-mono text-[12px] text-[#EF4444]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            —
          </div>
        ) : (
          <div
            className="font-mono text-[24px] leading-none tabular-nums"
            style={{
              color,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {value}
          </div>
        )}
      </div>
    </div>
  );
}
