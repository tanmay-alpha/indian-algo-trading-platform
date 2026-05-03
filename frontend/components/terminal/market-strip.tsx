'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { formatPrice, formatPercent, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function MarketStrip() {
  const { indices } = useTerminalStore()

  // Show placeholder data structure when no real data
  const displayIndices = indices.length > 0 ? indices : [
    { symbol: 'NIFTY 50', name: 'NIFTY 50', price: 0, change: 0, change_percent: 0 },
    { symbol: 'NIFTY BANK', name: 'NIFTY BANK', price: 0, change: 0, change_percent: 0 },
    { symbol: 'NIFTY IT', name: 'NIFTY IT', price: 0, change: 0, change_percent: 0 },
    { symbol: 'SENSEX', name: 'SENSEX', price: 0, change: 0, change_percent: 0 },
  ]

  return (
    <div className="h-9 px-4 flex items-center gap-6 bg-[#0d1117] border-b border-border overflow-x-auto">
      <span className="text-[10px] text-text-dim uppercase tracking-wider font-medium shrink-0">
        Indices
      </span>
      
      <div className="flex items-center gap-6">
        {displayIndices.map((index) => {
          const isPositive = index.change_percent >= 0
          const hasData = index.price > 0
          
          return (
            <div
              key={index.symbol}
              className="flex items-center gap-2 shrink-0"
            >
              <span className="text-xs text-text-main font-medium">
                {index.symbol}
              </span>
              <span className="font-mono text-xs text-text-main">
                {hasData ? formatPrice(index.price, 0) : '--,---'}
              </span>
              <div
                className={cn(
                  'flex items-center gap-0.5 text-xs font-mono',
                  hasData
                    ? isPositive
                      ? 'text-success'
                      : 'text-danger'
                    : 'text-text-dim'
                )}
              >
                {hasData && (
                  isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )
                )}
                <span>
                  {hasData ? formatPercent(index.change_percent) : '--'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
