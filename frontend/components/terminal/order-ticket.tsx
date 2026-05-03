'use client'

import { Lock, ShoppingCart } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtPrice, fmtVolume } from '@/lib/utils'

export function OrderTicket() {
  const tick = useTerminalStore((s) => s.currentTick)
  const mode = useTerminalStore((s) => s.executionMode)
  const symbol = useTerminalStore((s) => s.selectedSymbol) ?? tick?.symbol

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 px-3 flex items-center gap-2 border-b border-border bg-panel/50">
        <ShoppingCart className="w-4 h-4 text-info" />
        <span className="font-mono text-xs uppercase tracking-wider text-text">Order Ticket</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="border border-border bg-panel/70 rounded-sm p-3">
          <div className="text-[9px] font-mono uppercase tracking-wider text-text-faint">Symbol</div>
          <div className="mt-1 font-mono text-sm text-text">{symbol ?? '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="LTP" value={fmtPrice(tick?.ltp ?? tick?.price)} />
          <Stat label="Volume" value={fmtVolume(tick?.volume)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button disabled className="h-9 rounded-sm bg-up text-bg font-mono text-xs font-semibold uppercase">
            Buy
          </button>
          <button disabled className="h-9 rounded-sm bg-down text-white font-mono text-xs font-semibold uppercase">
            Sell
          </button>
        </div>
        <div className="flex items-start gap-2 border border-warn/20 bg-warn-dim text-warn rounded-sm p-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-2xs font-mono leading-relaxed">
            Live order placement disabled. Current mode: {mode}. Paper placeholders only.
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-panel/70 rounded-sm p-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-text-faint">{label}</div>
      <div className="mt-1 font-mono text-xs text-text">{value}</div>
    </div>
  )
}
