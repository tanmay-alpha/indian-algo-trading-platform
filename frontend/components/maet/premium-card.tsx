'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PremiumCardProps {
  children: ReactNode
  className?: string
  glow?: 'cyan' | 'green' | 'red' | 'amber' | 'none'
  onClick?: () => void
}

const glowMap = {
  cyan:  'hover:shadow-cyan hover:border-info/25',
  green: 'hover:shadow-up hover:border-up/25',
  red:   'hover:shadow-down hover:border-down/25',
  amber: 'hover:border-warn/25',
  none:  '',
}

export function PremiumCard({ children, className, glow = 'none', onClick }: PremiumCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'premium-card-glow p-4',
        glow !== 'none' && glowMap[glow],
        onClick && 'cursor-pointer active:scale-[0.985] transition-transform',
        className
      )}
    >
      {children}
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string | ReactNode
  sub?: string | ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function MetricCard({ label, value, sub, trend, className }: MetricCardProps) {
  return (
    <div className={cn('premium-card p-3', className)}>
      <div className="text-xs font-medium text-text-faint uppercase tracking-wide leading-tight mb-1">
        {label}
      </div>
      <div className={cn(
        'text-xl font-bold tabular-nums leading-tight',
        trend === 'up'   ? 'text-up'   :
        trend === 'down' ? 'text-down' :
        'text-text'
      )}>
        {value}
      </div>
      {sub && (
        <div className="text-xs text-text-dim mt-0.5">{sub}</div>
      )}
    </div>
  )
}
