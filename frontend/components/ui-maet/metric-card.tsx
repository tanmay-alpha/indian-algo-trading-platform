'use client'

import { ReactNode } from 'react'
import { PremiumCard } from './premium-card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: ReactNode
  subtext?: string
  change?: number
  changeLabel?: string
  className?: string
  glow?: boolean
}

export function MetricCard({ title, value, subtext, change, changeLabel, className, glow = false }: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0
  
  return (
    <PremiumCard glow={glow} className={cn("p-4 flex flex-col justify-between min-h-[105px]", className)}>
      <div>
        <div className="text-xs text-text-dim uppercase tracking-wider font-semibold">{title}</div>
        <div className="text-lg font-bold text-text mt-1.5 font-mono tracking-tight">{value}</div>
      </div>
      {(subtext || change !== undefined) && (
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04] text-xs">
          {change !== undefined ? (
            <span className={cn(
              "font-semibold font-mono",
              isPositive ? "text-[#16C784]" : "text-[#EA3943]"
            )}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
              {changeLabel && <span className="text-text-dim font-normal ml-1">({changeLabel})</span>}
            </span>
          ) : (
            <span className="text-text-dim">{subtext}</span>
          )}
        </div>
      )}
    </PremiumCard>
  )
}
