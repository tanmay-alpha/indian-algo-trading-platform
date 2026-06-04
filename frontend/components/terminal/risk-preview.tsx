'use client'

import { ShieldCheck } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'

export function RiskPreview() {
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const mode = useTerminalStore((s) => s.executionMode)

  const rows = [
    ['Execution', mode === 'PAPER' ? 'LOCKED TO PAPER' : 'LIVE GATED'],
    ['Broker', broker?.logged_in ? 'ONLINE' : broker ? 'Connecting...' : '-'],
    ['Feed', broker?.feed_token_available ? 'AVAILABLE' : '-'],
    ['Tick Drop', status?.tick_bus?.drop_rate_pct == null ? '-' : `${status.tick_bus.drop_rate_pct.toFixed(2)}%`],
    ['Max Qty', '-'],
    ['Max Notional', '-'],
    ['Max Daily Loss', '-'],
    ['Stale Data Rule', 'BLOCK'],
    ['Kill Switch', 'PLACEHOLDER'],
  ]

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 text-info">
        <ShieldCheck className="w-4 h-4" />
        <span className="font-mono text-xs uppercase tracking-wider">Risk / System</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="h-8 px-2 flex items-center justify-between border border-border bg-panel/60 rounded-md font-mono text-xs">
            <span className="text-text-dim">{label}</span>
            <span className="text-text">{value}</span>
          </div>
        ))}
      </div>
      <div className="border border-warn/20 bg-warn-dim text-warn rounded-sm p-2 text-2xs font-mono leading-relaxed">
        Live trading is disabled. This panel is a safety preview only.
      </div>
    </div>
  )
}
