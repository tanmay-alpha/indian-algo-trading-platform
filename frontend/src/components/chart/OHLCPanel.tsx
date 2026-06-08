'use client'

import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import { useTerminalStore } from '@/store/terminal-store'
import type { Candle } from '@/lib/types'

interface OHLCPanelProps {
  candle?: Candle | null
}

export function OHLCPanel({ candle }: OHLCPanelProps) {
  const activeSym = useTerminalStore((state) => state.activeSym)
  const fallback = DEMO_SYMBOLS.find((item) => item.sym === activeSym) ?? DEMO_SYMBOLS[0]
  const ohlc = candle ?? {
    time: 0,
    open: fallback.open,
    high: fallback.high,
    low: fallback.low,
    close: fallback.price,
    volume: fallback.vol,
  }
  const bullish = ohlc.close >= ohlc.open

  return (
    <section className="border border-border bg-surface p-3">
      <div className="font-mono text-[10px] uppercase text-text-muted">OHLC · {activeSym}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <OhlcCell label="Open" value={formatINR(ohlc.open)} tone={bullish ? 'up' : 'dn'} />
        <OhlcCell label="High" value={formatINR(ohlc.high)} tone="up" />
        <OhlcCell label="Low" value={formatINR(ohlc.low)} tone="dn" />
        <OhlcCell label="Close" value={formatINR(ohlc.close)} tone={bullish ? 'up' : 'dn'} />
      </div>
    </section>
  )
}

function OhlcCell({ label, value, tone }: { label: string; value: string; tone: 'up' | 'dn' }) {
  return (
    <div className="border border-border bg-base p-2">
      <div className="font-mono text-[9px] uppercase text-text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[11px] ${tone === 'up' ? 'text-up' : 'text-dn'}`}>
        {value}
      </div>
    </div>
  )
}
