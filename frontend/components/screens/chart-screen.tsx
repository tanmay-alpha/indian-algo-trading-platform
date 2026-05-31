'use client'

import { useState, useCallback } from 'react'
import { BarChart2, ShieldCheck } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { OrderTicket } from '@/components/terminal/order-ticket'
import { MobilePage } from '@/components/mobile/mobile-page'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { MobileActionSheet } from '@/components/mobile/mobile-action-sheet'

type Timeframe = '1m' | '5m' | '15m' | '1h' | '1D'
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '1D']

type Indicator = 'VWAP' | 'RSI' | 'EMA' | 'MACD'
const INDICATORS: Indicator[] = ['VWAP', 'RSI', 'EMA', 'MACD']

export function ChartScreen() {
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const currentTick    = useTerminalStore((s) => s.currentTick)
  const marketWatch    = useTerminalStore((s) => s.marketWatch)

  const [timeframe, setTimeframe]         = useState<Timeframe>('15m')
  const [activeIndicators, setIndicators] = useState<Set<Indicator>>(new Set(['VWAP']))
  const [showOrderSheet, setShowOrderSheet] = useState(false)

  const toggleIndicator = useCallback((ind: Indicator) => {
    setIndicators((prev) => {
      const next = new Set(prev)
      if (next.has(ind)) next.delete(ind)
      else next.add(ind)
      return next
    })
  }, [])

  const row     = selectedSymbol ? marketWatch[selectedSymbol] : null
  const ltp     = row?.ltp ?? currentTick?.ltp ?? null
  const chgPct  = row?.change_pct ?? null
  const isUp    = (chgPct ?? 0) > 0
  const cleanSym = selectedSymbol?.split(':').pop()?.split('-')[0] ?? selectedSymbol

  return (
    <MobilePage className="flex flex-col h-full pb-24 space-y-4">
      {/* Symbol header */}
      <div className="shrink-0">
        {selectedSymbol ? (
          <div className="flex items-center justify-between bg-white/[0.015] border border-white/[0.04] p-3 rounded-2xl">
            <div>
              <h2 className="text-base font-extrabold text-text tracking-wide leading-tight">
                {cleanSym}
              </h2>
              <div className="text-[10px] text-text-faint font-semibold uppercase tracking-wider mt-0.5">
                {row?.exchange ?? 'NSE'} · {row?.name ?? 'INDEX / STOCK'}
              </div>
            </div>
            {ltp != null ? (
              <div className="text-right">
                <div className={cn('text-lg font-bold font-mono tracking-tight leading-none', isUp ? 'text-[#16C784]' : 'text-[#EA3943]')}>
                  ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {chgPct != null && (
                  <div className={cn('text-[11px] font-bold font-mono mt-1', isUp ? 'text-[#16C784]' : 'text-[#EA3943]')}>
                    {isUp ? '+' : ''}{chgPct.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : (
              <div className="text-right">
                <div className="text-[11px] text-text-faint font-semibold tracking-wider uppercase">No Real-Time Tick</div>
                <div className="text-[10px] text-text-faint font-medium">Historical feeds only</div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl text-center">
            <span className="text-xs text-text-dim font-medium">Select a symbol from the Watchlist to view analysis</span>
          </div>
        )}
      </div>

      {/* Timeframe selector */}
      <div className="shrink-0">
        <SectionTitle title="Timeframe" />
        <div className="flex gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
                timeframe === tf
                  ? 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/30'
                  : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
              )}
              type="button"
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div className="flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.015] flex flex-col items-center justify-center relative overflow-hidden min-h-[180px] p-6 shadow-inner">
        <BarChart2 className="w-10 h-10 text-text-faint mb-3 opacity-60 animate-pulse" />
        <h3 className="text-xs font-bold text-text-dim uppercase tracking-wider">Historical Streams Locked</h3>
        <p className="text-[11px] text-text-faint max-w-[240px] text-center mt-1.5 leading-normal font-medium">
          Simulated candles for <span className="text-text font-bold">{cleanSym || 'INDEX'}</span> ({timeframe}) will connect once the broker feed poller resolves.
        </p>
        <span className="mt-3.5 text-[9px] font-mono font-bold tracking-wider uppercase bg-white/[0.04] border border-white/[0.08] text-text-faint px-2 py-0.5 rounded-full">
          No live candles shown
        </span>
      </div>

      {/* Indicators */}
      <div className="shrink-0">
        <SectionTitle title="Technical Indicators" />
        <div className="flex flex-wrap gap-2">
          {INDICATORS.map((ind) => {
            const active = activeIndicators.has(ind)
            return (
              <button
                key={ind}
                onClick={() => toggleIndicator(ind)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
                  active
                    ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                    : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
                )}
                type="button"
              >
                {ind}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action button */}
      <div className="shrink-0 pt-2">
        <button
          onClick={() => selectedSymbol && setShowOrderSheet(true)}
          disabled={!selectedSymbol}
          className={cn(
            "w-full h-12 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all duration-150",
            selectedSymbol
              ? "bg-[#F59E0B]/10 hover:bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B] shadow-[0_4px_16px_rgba(245,158,11,0.05)] active:scale-[0.985]"
              : "bg-white/[0.02] border-white/[0.05] text-text-faint cursor-not-allowed opacity-50"
          )}
          type="button"
        >
          <ShieldCheck className="w-4 h-4" />
          {selectedSymbol ? `Validate Dry-Run Order · ${cleanSym}` : 'Select Symbol to Validate'}
        </button>
      </div>

      {/* Action sheet containing OrderTicket */}
      <MobileActionSheet
        isOpen={showOrderSheet}
        onClose={() => setShowOrderSheet(false)}
        title={`Dry-Run Order Ticket: ${cleanSym}`}
      >
        <div className="h-[68vh]">
          <OrderTicket />
        </div>
      </MobileActionSheet>
    </MobilePage>
  )
}
