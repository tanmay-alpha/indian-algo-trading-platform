'use client'

import { useState, useCallback } from 'react'
import { BarChart2, ChevronDown, Info, ShieldCheck } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { OrderTicket } from '@/components/terminal/order-ticket'

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
    <div className="flex flex-col h-full">
      {/* Symbol header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        {selectedSymbol ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-text tracking-wide leading-tight">
                {cleanSym}
              </div>
              <div className="text-xs text-text-dim">{row?.exchange ?? 'NSE'} · {row?.name ?? ''}</div>
            </div>
            {ltp != null ? (
              <div className="text-right">
                <div className={cn('text-2xl font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
                  ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {chgPct != null && (
                  <div className={cn('text-sm font-medium tabular-nums', isUp ? 'text-up' : 'text-down')}>
                    {isUp ? '+' : ''}{chgPct.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : (
              <div className="text-right">
                <div className="text-sm text-text-faint font-mono">No price data</div>
                <div className="text-xs text-text-faint">Backend required</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-text-dim">Select a symbol from Watchlist</div>
        )}
      </div>

      {/* Timeframe chips */}
      <div className="px-4 pb-2 shrink-0 flex gap-2">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn('filter-chip text-xs', timeframe === tf && 'active')}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="flex-1 mx-4 mb-2 rounded-2xl border border-border/60 bg-bg-card flex flex-col items-center justify-center relative overflow-hidden">
        {!selectedSymbol ? (
          <ChartEmptyState reason="select" />
        ) : (
          <ChartEmptyState reason="no-candles" symbol={cleanSym ?? ''} tf={timeframe} />
        )}
      </div>

      {/* Indicator chips */}
      <div className="px-4 pb-2 shrink-0 flex gap-2">
        {INDICATORS.map((ind) => (
          <button
            key={ind}
            onClick={() => toggleIndicator(ind)}
            className={cn('filter-chip text-xs', activeIndicators.has(ind) && 'active')}
          >
            {ind}
          </button>
        ))}
      </div>

      {/* Sticky bottom — Dry-run action */}
      <div className="px-4 pb-3 shrink-0">
        <DryRunOrderButton symbol={selectedSymbol} />
      </div>
    </div>
  )
}

function ChartEmptyState({ reason, symbol, tf }: { reason: 'select' | 'no-candles'; symbol?: string; tf?: string }) {
  if (reason === 'select') {
    return (
      <div className="text-center px-6">
        <BarChart2 className="w-10 h-10 text-text-faint mx-auto mb-3" />
        <div className="text-sm font-semibold text-text-2">No symbol selected</div>
        <div className="text-xs text-text-faint mt-1 leading-relaxed">
          Go to Watchlist and tap a symbol to load the chart.
        </div>
      </div>
    )
  }

  return (
    <div className="text-center px-6">
      <BarChart2 className="w-10 h-10 text-text-faint mx-auto mb-3" />
      <div className="text-sm font-semibold text-text-2">Chart not yet connected</div>
      <div className="text-xs text-text-faint mt-1 leading-relaxed">
        Real candle data for <strong className="text-text">{symbol}</strong> ({tf}) will load when backend broker candle feed is available.
      </div>
      <div className="mt-3 text-[10px] font-mono text-text-faint bg-white/[0.03] border border-border/50 rounded-lg px-3 py-2">
        No demo candles shown — real data only
      </div>
    </div>
  )
}

function DryRunOrderButton({ symbol }: { symbol: string | null }) {
  const [showSheet, setShowSheet] = useState(false)

  if (!symbol) {
    return (
      <button disabled className="w-full maet-btn maet-btn-ghost opacity-40 h-12 rounded-xl text-sm">
        <ShieldCheck className="w-4 h-4" />
        Select symbol to validate dry-run
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowSheet(true)}
        className="w-full h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-sm flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
      >
        <ShieldCheck className="w-4 h-4" />
        Validate Dry-Run Order · {symbol.split(':').pop()?.split('-')[0]}
      </button>

      {showSheet && (
        <DryRunOrderSheet symbol={symbol} onClose={() => setShowSheet(false)} />
      )}
    </>
  )
}

function DryRunOrderSheet({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0B0F17] rounded-t-3xl border-t border-border/60 slide-in-bottom flex flex-col h-[75vh] overflow-hidden">
        {/* Pull bar */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60 mx-auto" />
        </div>
        
        {/* Embed OrderTicket */}
        <div className="flex-1 min-h-0">
          <OrderTicket />
        </div>

        {/* Close Button / Bottom spacing */}
        <div className="p-3 border-t border-border/40 bg-bg/90 backdrop-blur-md shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-white/5 border border-border/60 text-sm text-text-dim font-medium active:scale-95 transition-all"
          >
            Close Ticket
          </button>
        </div>
      </div>
    </div>
  )
}
