'use client'

import { Cpu, AlertTriangle, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIAdvisoryCardProps {
  symbol?: string
  signal?: 'BUY' | 'SELL' | 'HOLD'
  confidence?: number
  reason?: string
}

export function AIAdvisoryCard({
  symbol = 'NIFTY 50',
  signal = 'BUY',
  confidence = 88.5,
  reason = 'Bullish momentum breakout above 24,200 level with strong volume confirmation.'
}: AIAdvisoryCardProps) {
  return (
    <div className="glass-card-3d rounded-lg p-4 border border-warn/10 text-left select-none relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-warn/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-warn/10 flex items-center justify-center border border-warn/20 text-warn">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-white tracking-wider uppercase">AI Core Signal</h4>
            <p className="text-[10px] font-mono text-text-dim">Advisory analytics</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full border border-warn/30 bg-warn/10 text-warn font-mono text-[10px] font-semibold tracking-wider flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-warn" />
          ADVISORY ONLY
        </span>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-white/[0.01] p-2.5 rounded border border-white/[0.02]">
          <div>
            <span className="text-[10px] text-text-faint block uppercase font-mono">{symbol} Signal</span>
            <span className={cn(
              "text-sm font-black font-mono tracking-wider block mt-0.5",
              signal === 'BUY' ? 'text-up text-glow-green' : signal === 'SELL' ? 'text-down text-glow-red' : 'text-text-2'
            )}>
              {signal}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-text-faint block uppercase font-mono">Confidence</span>
            <span className="text-xs font-semibold text-white font-mono block mt-0.5">
              {confidence.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white/[0.01] p-2.5 rounded border border-white/[0.02]">
          <span className="text-[10px] text-text-faint block uppercase font-mono mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-warn" /> Strategy Insight
          </span>
          <p className="text-[11px] text-text-2 leading-relaxed">
            {reason}
          </p>
        </div>

        <div className="text-[10px] text-text-dim font-mono flex items-center gap-1.5 opacity-60">
          <TrendingUp className="w-3 h-3" />
          <span>Updates automatically on block discovery.</span>
        </div>
      </div>
    </div>
  )
}
