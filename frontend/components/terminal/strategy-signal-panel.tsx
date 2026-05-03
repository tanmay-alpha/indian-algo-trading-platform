'use client'

import { Radio } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { EmptyState } from './empty-state'
import { cn } from '@/lib/utils'

export function StrategySignalPanel() {
  const signals = useTerminalStore((s) => s.signals)

  if (signals.length === 0) {
    return (
      <EmptyState
        title="NO SIGNALS"
        hint="Strategy events will appear when published by the backend."
        icon={<Radio className="w-6 h-6" />}
        compact
      />
    )
  }

  return (
    <div className="p-3 space-y-2">
      {signals.slice(0, 12).map((signal, index) => (
        <div key={`${signal.symbol}-${signal.ts ?? index}`} className="border border-border bg-panel/70 rounded-sm p-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-text">{signal.symbol}</span>
            <span className={cn(signal.action === 'BUY' && 'text-up', signal.action === 'SELL' && 'text-down', signal.action === 'NEUTRAL' && 'text-text-dim')}>
              {signal.action}
            </span>
          </div>
          <div className="mt-1 text-2xs font-mono text-text-dim">{signal.reason ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}
