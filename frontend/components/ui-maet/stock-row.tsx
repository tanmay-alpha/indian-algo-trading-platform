'use client'

import { cn } from '@/lib/utils'

interface StockRowProps {
  symbol: string
  name?: string
  exchange?: string
  price?: number | null
  change?: number | null
  isSelected?: boolean
  onClick?: () => void
}

export function StockRow({ symbol, name, exchange = 'NSE', price, change = 0, isSelected = false, onClick }: StockRowProps) {
  const hasPrice = price != null
  const hasChange = change != null
  const isPositive = (change ?? 0) >= 0
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`Open chart for ${symbol}`}
      className={cn(
        "w-full min-h-[60px] flex items-center justify-between p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] transition-all duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60",
        onClick && "cursor-pointer hover:bg-white/[0.035] active:scale-[0.99]",
        !onClick && "cursor-default",
        isSelected && "bg-white/[0.05] border-[#22D3EE]/30 shadow-[0_4px_12px_rgba(34,211,238,0.05)]"
      )}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-text tracking-wide truncate">{symbol}</span>
          <span className="text-[9px] font-mono font-semibold px-1 py-0.25 rounded bg-white/[0.06] text-text-dim border border-white/[0.04] uppercase shrink-0">
            {exchange}
          </span>
        </div>
        {name && <span className="text-[10px] text-text-faint mt-0.5 truncate max-w-[180px]">{name}</span>}
      </div>
      
      <div className="text-right shrink-0 ml-4">
        <div className="text-xs font-bold font-mono text-text tabular-nums">
          {hasPrice
            ? price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—'}
        </div>
        <span className={cn(
          "text-[10px] font-semibold font-mono inline-block mt-0.5 tabular-nums",
          hasChange ? (isPositive ? "text-[#16C784]" : "text-[#EA3943]") : "text-text-faint"
        )}>
          {hasChange ? `${isPositive ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </span>
      </div>
    </button>
  )
}
