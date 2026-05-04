'use client'

import { Activity, LockKeyhole } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { BUILD_ENV, INDEX_TILES, WORKSPACES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useIstClock } from '@/lib/use-ist-clock'
import { IndexTicker } from './index-ticker'
import { OperatorStatusStrip } from './operator-status-strip'
import { WorkspacePresetSelector } from './workspace-preset-selector'
import type { IndexSnapshot } from '@/lib/types'

export function TopMarketBar() {
  const indices = useTerminalStore((s) => s.indices)
  const mode = useTerminalStore((s) => s.executionMode)
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const clock = useIstClock()

  const indexBySymbol: Record<string, IndexSnapshot | undefined> = {}
  for (const index of indices) indexBySymbol[index.symbol] = index

  const workspace = WORKSPACES.find((item) => item.id === activeWorkspace)
  const locked = mode === 'PAPER'

  return (
    <header className="relative h-topbar shrink-0 border-b border-border bg-bg-2 flex items-stretch shadow-panel">
      {(backendWakeState === 'WAKING' || apiStatus === 'OFFLINE') && (
        <div className="absolute right-4 top-full z-40 mt-2 rounded-sm border border-info/25 bg-bg-2/95 px-3 py-2 text-[10px] font-mono text-info shadow-panel">
          <span className="inline-block mr-2 h-1.5 w-1.5 rounded-full bg-info animate-pulse-soft" />
          {backendWakeState === 'WAKING'
            ? 'Backend waking up on free tier... this can take about 30 seconds.'
            : 'Backend unavailable - retrying.'}
        </div>
      )}
      <div className="w-[330px] px-3 flex items-center gap-3 border-r border-border">
        <div className="h-8 w-8 grid place-items-center rounded-md border border-info/25 bg-info-dim text-info">
          <Activity className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-text">MAET Terminal</span>
            <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[9px] font-mono text-text-dim">
              {BUILD_ENV} PREVIEW
            </span>
          </div>
          <div className="text-[10px] text-text-faint">
            Market Analytics & Execution Terminal
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 overflow-x-auto">
        <div className="mr-1 hidden xl:flex flex-col leading-none">
          <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint">
            {workspace?.label ?? 'Workspace'}
          </span>
          <span className="text-[10px] text-text-dim">market strip</span>
        </div>
        {INDEX_TILES.map((tile) => (
          <IndexTicker
            key={tile.symbol}
            label={tile.label}
            snapshot={indexBySymbol[tile.symbol]}
          />
        ))}
      </div>

      <div className="min-w-[470px] px-3 flex items-center gap-2 border-l border-border">
        <WorkspacePresetSelector />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 h-[24px] rounded-sm border text-[10px] font-mono uppercase tracking-wider',
            locked
              ? 'text-paper border-paper/30 bg-info-dim'
              : 'text-live border-live/30 bg-down-dim'
          )}
        >
          <LockKeyhole className="w-3 h-3" />
          {locked ? 'Paper locked' : 'Live gated'}
        </span>
        <span className="inline-flex items-center px-2 h-[24px] rounded-sm border border-border bg-panel/70 text-[10px] font-mono text-text-2">
          {clock.time} <span className="ml-1 text-text-faint">IST</span>
        </span>
        <span className="hidden 2xl:inline-flex items-center px-2 h-[24px] rounded-sm border border-border bg-panel/70 text-[10px] font-mono text-text-dim">
          {clock.sessionLabel}
        </span>
        <div className="h-6 w-px bg-border mx-1" />
        <OperatorStatusStrip />
      </div>
    </header>
  )
}
