'use client'

import { ChartArea } from '@/components/chart/ChartArea'
import { OHLCPanel } from '@/components/chart/OHLCPanel'
import { useCandles } from '@/hooks/useCandles'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTerminalStore } from '@/store/terminal-store'
import { DEMO_SYMBOLS } from '@/lib/demoSymbols'
import { TopBar } from './TopBar'
import { WatchlistPanel } from './WatchlistPanel'
import { StatusBar } from './StatusBar'

function formatPrice(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export function TerminalLayout() {
  useWebSocket()

  const activeSym = useTerminalStore((state) => state.activeSym)
  const chartTimeframe = useTerminalStore((state) => state.chartTimeframe)
  const setActiveSym = useTerminalStore((state) => state.setActiveSym)
  const { candles, isDemo, isLoading } = useCandles(activeSym, chartTimeframe)
  const active = DEMO_SYMBOLS.find((item) => item.sym === activeSym) ?? DEMO_SYMBOLS[0]
  const lastCandle = candles[candles.length - 1] ?? null
  const firstCandle = candles[0] ?? null
  const ticks = 12840 + DEMO_SYMBOLS.findIndex((item) => item.sym === active.sym) * 167
  const dayPnl =
    firstCandle && lastCandle
      ? (lastCandle.close - firstCandle.open) * 10
      : active.chg >= 0
      ? 1240.75
      : -640.25

  return (
    <main className="flex h-[100dvh] overflow-hidden bg-base text-primary">
      <div className="flex min-h-0 w-full flex-col">
        <TopBar />

        <section className="flex min-h-0 flex-1">
          <WatchlistPanel activeSymbol={activeSym} onSelect={(symbol) => setActiveSym(symbol.sym)} />

          <ChartArea candles={candles} isDemo={isDemo} isLoading={isLoading} />

          <aside className="flex min-h-0 w-[216px] shrink-0 flex-col gap-3 border-l border-border bg-panel p-3">
            <OHLCPanel candle={lastCandle} />

            <section className="border border-border bg-surface p-3">
              <div className="font-mono text-[10px] uppercase text-muted">Order context</div>
              <div className="mt-3 space-y-3">
                <InfoRow label="Symbol" value={active.sym} />
                <InfoRow label="Mode" value="Paper" />
                <InfoRow label="Last" value={formatPrice(lastCandle?.close ?? active.price)} />
                <InfoRow label="Risk" value="No submit" />
              </div>
            </section>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 font-mono text-[10px]">
      <span className="text-muted">{label}</span>
      <span className="truncate text-primary">{value}</span>
    </div>
  )
}
