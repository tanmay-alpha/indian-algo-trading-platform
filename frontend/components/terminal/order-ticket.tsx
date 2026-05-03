'use client'

import { useState } from 'react'
import { Zap, AlertTriangle } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { formatPrice, formatCurrency, cn } from '@/lib/utils'

export function OrderTicket() {
  const { currentTick, executionMode, autoPilot, portfolio } = useTerminalStore()
  const [orderQty, setOrderQty] = useState(1)

  const price = currentTick?.price || 0
  const vwap = currentTick?.vwap || 0
  const signal = currentTick?.signal || 'NEUTRAL'
  const unrealizedPnl = portfolio?.unrealized_pnl || 0
  const equity = portfolio?.current_capital || 0

  return (
    <div className="h-full flex flex-col glass border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Order Ticket</h3>
        <div
          className={cn(
            'px-2 py-0.5 rounded text-[9px] font-semibold uppercase',
            autoPilot
              ? 'bg-success/10 text-success'
              : 'bg-white/5 text-text-dim'
          )}
        >
          {autoPilot ? 'AUTONOMOUS' : 'MANUAL'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="LTP" value={formatPrice(price)} />
          <MetricCard label="VWAP" value={formatPrice(vwap)} accent />
          <MetricCard
            label="PnL"
            value={formatCurrency(unrealizedPnl)}
            positive={unrealizedPnl > 0}
            negative={unrealizedPnl < 0}
          />
          <MetricCard label="Equity" value={formatCurrency(equity)} />
        </div>
      </div>

      {/* Order Entry */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Order Quantity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-text-dim uppercase tracking-wider">
            Order Size
          </label>
          <input
            type="number"
            min={1}
            value={orderQty}
            onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 bg-black/20 border border-border rounded font-mono text-sm focus:outline-none focus:border-accent/50"
            disabled
          />
        </div>

        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled
            className="py-3 rounded font-bold text-sm uppercase bg-success text-white opacity-50 cursor-not-allowed"
            title="Order execution disabled"
          >
            Buy
          </button>
          <button
            disabled
            className="py-3 rounded font-bold text-sm uppercase bg-danger text-white opacity-50 cursor-not-allowed"
            title="Order execution disabled"
          >
            Sell
          </button>
        </div>

        {/* Disabled Notice */}
        <div className="flex items-start gap-2 p-3 rounded bg-warning/10 border border-warning/20 text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed">
            Order execution is disabled. This terminal is in read-only mode for market data visualization.
          </p>
        </div>

        {/* Auto-Pilot Toggle (Disabled) */}
        <div className="p-3 rounded bg-accent/5 border border-accent/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-accent">AUTO-PILOT</span>
            </div>
            <div className="relative w-10 h-5">
              <input
                type="checkbox"
                checked={autoPilot}
                disabled
                className="sr-only"
              />
              <div
                className={cn(
                  'w-10 h-5 rounded-full transition-colors cursor-not-allowed',
                  autoPilot ? 'bg-success' : 'bg-gray-600'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    autoPilot ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Signal Banner */}
        <div
          className={cn(
            'p-3 rounded text-center text-xs font-bold uppercase border',
            signal === 'BUY' && 'bg-success/10 text-success border-success/20',
            signal === 'SELL' && 'bg-danger/10 text-danger border-danger/20',
            signal === 'NEUTRAL' && 'bg-white/5 text-text-dim border-white/10'
          )}
        >
          Quant Signal: {signal}
        </div>
      </div>

      {/* Mode Toggle (Disabled) */}
      <div className="p-4 border-t border-border">
        <button
          disabled
          className="w-full py-2 rounded text-[10px] font-medium uppercase bg-white/5 text-text-dim border border-border cursor-not-allowed"
        >
          Toggle Execution Mode
        </button>
        <p className="text-[9px] text-text-dim text-center mt-2">
          Current: {executionMode} Mode
        </p>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
  positive,
  negative,
}: {
  label: string
  value: string
  accent?: boolean
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="p-2.5 rounded bg-white/[0.02] border border-border/50 hover:border-border transition-colors">
      <div className="text-[9px] text-text-dim uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-sm font-semibold',
          accent && 'text-accent',
          positive && 'text-success',
          negative && 'text-danger',
          !accent && !positive && !negative && 'text-text-main'
        )}
      >
        {value}
      </div>
    </div>
  )
}
