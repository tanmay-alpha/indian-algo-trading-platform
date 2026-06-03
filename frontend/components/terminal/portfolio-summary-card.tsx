'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PortfolioSummaryCard() {
  const portfolio = useTerminalStore((s) => s.portfolio)
  
  const totalValue = portfolio?.current_capital ?? 1000000
  const totalPnl = (portfolio?.realized_pnl ?? 0) + (portfolio?.unrealized_pnl ?? 0)
  const marginAvailable = portfolio?.current_capital ?? 1000000
  
  const formattedValue = totalValue.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  })

  const formattedPnl = totalPnl.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  })

  const formattedMargin = marginAvailable.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  })

  const pnlPercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0
  const isPositive = totalPnl >= 0

  return (
    <div className="glass-card-3d rounded-lg p-4 border border-[#38bdf8]/10 text-left select-none relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-info/10 flex items-center justify-center border border-info/20 text-[#38bdf8]">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wider uppercase">Portfolio Summary</h4>
            <p className="text-xs font-mono text-text-dim">Read-only status</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full border border-info/30 bg-info/10 text-info font-mono text-xs font-semibold tracking-wider">
          READ-ONLY / PAPER
        </span>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Net Value */}
        <div className="bg-white/[0.01] p-2.5 rounded border border-white/[0.02] flex items-center justify-between">
          <div>
            <span className="text-xs text-text-faint block uppercase font-mono">Net Portfolio Value</span>
            <span className="text-sm font-bold text-white font-mono tracking-wider block mt-0.5">
              {formattedValue}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-text-faint block uppercase font-mono">Total PnL</span>
            <span className={cn(
              "text-xs font-bold font-mono block mt-0.5",
              isPositive ? 'text-up text-glow-green' : 'text-down text-glow-red'
            )}>
              {isPositive ? '+' : ''}{formattedPnl} ({pnlPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Marginal / Collateral */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-white/[0.01] p-2 rounded border border-white/[0.02]">
            <span className="text-xs text-text-faint block uppercase">Available Margin</span>
            <span className="font-semibold text-white block truncate mt-0.5">{formattedMargin}</span>
          </div>
          <div className="bg-white/[0.01] p-2 rounded border border-white/[0.02]">
            <span className="text-xs text-text-faint block uppercase">Reconciliation</span>
            <span className="font-semibold text-info block truncate mt-0.5">SECURE PASS</span>
          </div>
        </div>
      </div>
    </div>
  )
}
