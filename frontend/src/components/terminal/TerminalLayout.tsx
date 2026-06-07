'use client'

import { useMemo, useState } from 'react'
import { DEMO_SYMBOLS, type DemoSymbol } from '@/lib/demoSymbols'
import { TopBar } from './TopBar'
import { WatchlistPanel } from './WatchlistPanel'
import { StatusBar } from './StatusBar'

function formatPrice(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function buildChartPoints(symbol: DemoSymbol) {
  const span = Math.max(1, symbol.high - symbol.low)
  return Array.from({ length: 34 }, (_, index) => {
    const wave = Math.sin(index / 3.8) * 0.35 + Math.cos(index / 6) * 0.22
    const trend = symbol.chg >= 0 ? index * 0.012 : -index * 0.012
    const normalized = 0.48 + wave + trend
    const clamped = Math.max(0.08, Math.min(0.92, normalized))
    return {
      x: (index / 33) * 100,
      y: 92 - clamped * 76,
      price: symbol.low + clamped * span,
    }
  })
}

export function TerminalLayout() {
  const [active, setActive] = useState<DemoSymbol>(DEMO_SYMBOLS[0])
  const points = useMemo(() => buildChartPoints(active), [active])
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const positive = active.chg >= 0
  const ticks = 12840 + DEMO_SYMBOLS.findIndex((item) => item.sym === active.sym) * 167
  const dayPnl = positive ? 1240.75 : -640.25

  return (
    <main className="flex h-[100dvh] overflow-hidden bg-base text-primary">
      <div className="flex min-h-0 w-full flex-col">
        <TopBar />

        <section className="flex min-h-0 flex-1">
          <WatchlistPanel activeSymbol={active.sym} onSelect={setActive} />

          <section className="flex min-w-0 flex-1 flex-col bg-base p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase text-muted">NSE / demo quote</div>
                <h1 className="mt-1 font-mono text-2xl font-medium text-primary">{active.sym}</h1>
                <div className="text-xs text-muted">{active.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-medium text-primary">{formatPrice(active.price)}</div>
                <div className={`font-mono text-xs ${positive ? 'text-up' : 'text-dn'}`}>
                  {positive ? '+' : ''}{active.chg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}%
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <Metric label="Open" value={formatPrice(active.open)} />
              <Metric label="High" value={formatPrice(active.high)} tone="up" />
              <Metric label="Low" value={formatPrice(active.low)} tone="dn" />
              <Metric label="Last" value={formatPrice(active.price)} />
            </div>

            <div className="relative mt-4 min-h-0 flex-1 border border-border bg-panel">
              <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:48px_48px]" />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${active.sym} demo chart`}>
                <path d={path} fill="none" stroke={positive ? 'var(--color-up)' : 'var(--color-dn)'} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                <path d={`${path} L 100 100 L 0 100 Z`} fill={positive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'} />
              </svg>
              <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted">Demo data shown when live feed is unavailable</div>
            </div>
          </section>

          <aside className="flex min-h-0 w-[216px] shrink-0 flex-col border-l border-border bg-panel p-3">
            <div className="font-mono text-[11px] uppercase text-muted">Order context</div>
            <div className="mt-3 space-y-3">
              <InfoRow label="Symbol" value={active.sym} />
              <InfoRow label="Mode" value="Paper" />
              <InfoRow label="Broker" value="Locked" />
              <InfoRow label="Risk" value="No submit" />
            </div>
            <div className="mt-auto border border-border-strong bg-surface p-3">
              <div className="font-mono text-[10px] uppercase text-warn">Execution locked</div>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                Paper terminal view. Real orders are disabled in this build.
              </p>
            </div>
          </aside>
        </section>

        <StatusBar ticks={ticks} dayPnl={dayPnl} />
      </div>
    </main>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'dn' }) {
  const toneClass = tone === 'up' ? 'text-up' : tone === 'dn' ? 'text-dn' : 'text-primary'

  return (
    <div className="border border-border bg-panel p-2">
      <div className="font-mono text-[10px] uppercase text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[12px] ${toneClass}`}>{value}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 font-mono text-[10px]">
      <span className="text-muted">{label}</span>
      <span className="text-primary">{value}</span>
    </div>
  )
}
