'use client'

import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { BUILD_ENV, INDEX_TILES } from '@/lib/constants'
import { cn, getNseMarketSession } from '@/lib/utils'
import { useIstClock } from '@/lib/use-ist-clock'
import { WorkspacePresetSelector } from './workspace-preset-selector'
import { ChartLayoutSelector } from './chart-layout-selector'
import { OperatorStatusStrip } from './operator-status-strip'
import type { IndexSnapshot, NseMarketSession } from '@/lib/types'

export function TopMarketBar() {
  const [mounted, setMounted] = useState(false)
  const indices = useTerminalStore((s) => s.indices)
  const mode = useTerminalStore((s) => s.executionMode)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const istTime = useIstClock()

  useEffect(() => {
    setMounted(true)
  }, [])

  const session = mounted ? getNseMarketSession() : 'CLOSED'

  const indexBySymbol: Record<string, IndexSnapshot | undefined> = {}
  if (indices) {
    for (const index of indices) indexBySymbol[index.symbol] = index
  }

  return (
    <header className="flex h-topbar shrink-0 items-center border-b border-border bg-bg">
      {(backendWakeState === 'WAKING' || apiStatus === 'OFFLINE') && (
        <div className="absolute right-4 top-[42px] z-40 rounded-sm border border-info/25 bg-bg-2/95 px-3 py-2 text-[10px] font-mono text-info shadow-panel">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-info animate-pulse-soft" />
          {backendWakeState === 'WAKING'
            ? 'Backend waking up on free tier... this can take about 30 seconds.'
            : 'Backend unavailable - retrying.'}
        </div>
      )}

      <div className="flex h-full w-rail shrink-0 items-center justify-center border-r border-border bg-panel/50">
        <span className="font-mono text-[11px] font-black tracking-wider text-info">MAET</span>
      </div>

      <div className="flex h-full shrink-0 items-center gap-2 border-r border-border px-3">
        <div>
          <div className="text-[11px] font-semibold leading-tight text-text">MAET Terminal</div>
          <div className="text-[9px] font-mono text-text-faint">Market Analytics · Paper Demo</div>
        </div>
        <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[9px] font-mono text-text-faint">
          {BUILD_ENV}
        </span>
      </div>

      <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto border-r border-border">
        <div className="flex h-full items-stretch">
          {INDEX_TILES.map((tile) => (
            <IndexTile
              key={tile.symbol}
              label={tile.label}
              snapshot={indexBySymbol[tile.symbol]}
            />
          ))}
        </div>
      </div>

      <div className="flex h-full min-w-[300px] max-w-[34vw] shrink-0 items-stretch border-r border-border">
        <OperatorStatusStrip />
      </div>

      <div className="flex h-full shrink-0 items-center gap-2 px-3">
        <ChartLayoutSelector />
        <WorkspacePresetSelector />
        <div className="font-mono text-[11px] tabular-nums text-text">
          {istTime || '--:--:--'} IST
        </div>
        <SessionBadge session={session} />
        <div className="inline-flex items-center gap-1.5 rounded border border-border bg-panel px-2 py-0.5 text-[9px] font-mono text-paper">
          <LockKeyhole className="h-3 w-3" />
          {mode === 'PAPER' ? 'PAPER LOCKED' : 'LIVE GATED'}
        </div>
      </div>
    </header>
  )
}

function IndexTile({
  label,
  snapshot,
}: {
  label: string
  snapshot?: IndexSnapshot
}) {
  const value = snapshot?.ltp ?? null
  const change = snapshot?.change_pct ?? null
  return (
    <div className="flex h-full min-w-[120px] flex-col items-start justify-center border-r border-border px-4">
      <div className="font-mono text-[9px] text-text-faint">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[12px] font-semibold tabular-nums text-text">
          {value != null ? value.toLocaleString('en-IN') : '—'}
        </span>
        <span
          className={cn(
            'font-mono text-[10px] tabular-nums',
            change != null && change > 0
              ? 'text-up'
              : change != null && change < 0
              ? 'text-down'
              : 'text-text-faint'
          )}
        >
          {change != null ? `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%` : 'WAITING'}
        </span>
      </div>
    </div>
  )
}

function SessionBadge({ session }: { session: NseMarketSession }) {
  const label =
    session === 'OPEN' || session === 'LIVE'
      ? 'MARKET OPEN'
      : session === 'PRE_MARKET'
      ? 'PRE-MARKET'
      : session === 'POST_MARKET'
      ? 'POST-MARKET'
      : session === 'WEEKEND'
      ? 'WEEKEND'
      : 'CLOSED'

  return (
    <div
      className={cn(
        'rounded border px-2 py-0.5 text-[9px] font-mono font-semibold tracking-widest',
        session === 'OPEN' || session === 'LIVE'
          ? 'border-up/20 bg-up/15 text-up'
          : 'border-border bg-panel-3 text-text-faint'
      )}
    >
      {label}
    </div>
  )
}
