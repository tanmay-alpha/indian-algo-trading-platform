'use client'

import { Activity, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { BUILD_ENV, INDEX_TILES, WORKSPACES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { IndexTicker } from './index-ticker'
import { OperatorStatusStrip } from './operator-status-strip'
import { WorkspacePresetSelector } from './workspace-preset-selector'
import type { IndexSnapshot } from '@/lib/types'

function useIstClock() {
  const [now, setNow] = useState('00:00:00')
  useEffect(() => {
    const tick = () => {
      const date = new Date()
      setNow(
        date.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function TopMarketBar() {
  const indices = useTerminalStore((s) => s.indices)
  const mode = useTerminalStore((s) => s.executionMode)
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const ist = useIstClock()

  const indexBySymbol: Record<string, IndexSnapshot | undefined> = {}
  for (const index of indices) indexBySymbol[index.symbol] = index

  const workspace = WORKSPACES.find((item) => item.id === activeWorkspace)
  const locked = mode === 'PAPER'

  return (
    <header className="h-topbar shrink-0 border-b border-border bg-bg-2 flex items-stretch shadow-panel">
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
          {ist} <span className="ml-1 text-text-faint">IST</span>
        </span>
        <div className="h-6 w-px bg-border mx-1" />
        <OperatorStatusStrip />
      </div>
    </header>
  )
}
