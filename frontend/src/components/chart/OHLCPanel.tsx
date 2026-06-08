'use client'

import { useTerminalStore } from '@/store/terminal-store'
import type { Candle } from '@/lib/types'

interface OHLCPanelProps {
  candle: Candle | null
}

function formatPrice(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export function OHLCPanel({ candle }: OHLCPanelProps) {
  const activeSym = useTerminalStore((state) => state.activeSym)

  if (!candle) {
    return (
      <section className="border border-border bg-surface p-3">
        <div className="font-mono text-[10px] uppercase text-muted">{activeSym} OHLC</div>
        <div className="mt-3 font-mono text-[10px] text-muted">Preparing chart data</div>
      </section>
    )
  }

  const bullish = candle.close >= candle.open

  return (
    <section className="border border-border bg-surface p-3">
      <div className="font-mono text-[10px] uppercase text-muted">{activeSym} OHLC</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <OhlcCell label="Open" value={formatPrice(candle.open)} tone={bullish ? 'up' : 'dn'} />
        <OhlcCell label="High" value={formatPrice(candle.high)} tone="up" />
        <OhlcCell label="Low" value={formatPrice(candle.low)} tone="dn" />
        <OhlcCell label="Close" value={formatPrice(candle.close)} tone={bullish ? 'up' : 'dn'} />
      </div>
    </section>
  )
}

function OhlcCell({ label, value, tone }: { label: string; value: string; tone: 'up' | 'dn' }) {
  return (
    <div className="border border-border bg-base p-2">
      <div className="font-mono text-[9px] uppercase text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[11px] ${tone === 'up' ? 'text-up' : 'text-dn'}`}>
        {value}
      </div>
    </div>
  )
}
