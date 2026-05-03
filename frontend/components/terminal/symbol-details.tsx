'use client'

import { Info } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtPrice, fmtVolume } from '@/lib/utils'
import { EmptyState } from './empty-state'

export function SymbolDetails() {
  const selected = useTerminalStore((s) => s.selectedSymbol)
  const market = useTerminalStore((s) => s.marketWatch)
  const row = selected ? market[selected] : null

  if (!selected) {
    return <EmptyState title="NO SYMBOL SELECTED" hint="Select a watchlist row or use command palette search." compact />
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 text-info">
        <Info className="w-4 h-4" />
        <span className="font-mono text-xs uppercase tracking-wider">Symbol Details</span>
      </div>
      <div className="border border-border bg-panel/70 rounded-sm p-3">
        <div className="font-mono text-sm text-text">{selected}</div>
        <div className="mt-1 text-2xs font-mono text-text-dim">{row?.name ?? 'Instrument metadata unavailable'}</div>
      </div>
      <InfoRow label="LTP" value={fmtPrice(row?.ltp)} />
      <InfoRow label="Best Bid" value={fmtPrice(row?.best_bid)} />
      <InfoRow label="Best Ask" value={fmtPrice(row?.best_ask)} />
      <InfoRow label="VWAP" value={fmtPrice(row?.vwap)} />
      <InfoRow label="Volume" value={fmtVolume(row?.volume)} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="h-8 px-2 flex items-center justify-between border border-border bg-panel/60 rounded-sm font-mono text-xs">
      <span className="text-text-dim">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  )
}
