'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { INDEX_TILES, BUILD_ENV, WORKSPACES } from '@/lib/constants'
import { IndexTicker } from './index-ticker'
import { OperatorStatusStrip } from './operator-status-strip'
import { WorkspacePresetSelector } from './workspace-preset-selector'
import { cn } from '@/lib/utils'
import type { IndexSnapshot } from '@/lib/types'

function useIstClock() {
  const [now, setNow] = useState<string>('—:—:—')
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const hh = String(ist.getHours()).padStart(2, '0')
      const mm = String(ist.getMinutes()).padStart(2, '0')
      const ss = String(ist.getSeconds()).padStart(2, '0')
      setNow(`${hh}:${mm}:${ss}`)
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
  for (const i of indices) indexBySymbol[i.symbol] = i

  const ws = WORKSPACES.find((w) => w.id === activeWorkspace)

  return (
    <div className="h-topbar shrink-0 border-b border-border bg-bg-2 flex items-stretch">
      {/* Brand + workspace label */}
      <div className="flex items-center gap-3 px-3 border-r border-border min-w-[260px]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-info" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            MAET<span className="text-info">.OS</span>
          </span>
        </div>
        <span className="h-4 w-px bg-border" />
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint">
            Workspace
          </span>
          <span className="text-xs font-mono text-text">
            {ws ? ws.label.toUpperCase() : '—'}
          </span>
        </div>
      </div>

      {/* Index strip */}
      <div className="flex-1 flex items-center gap-1.5 px-3 overflow-x-auto">
        <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint shrink-0 mr-1">
          IDX
        </span>
        {INDEX_TILES.map((t) => (
          <IndexTicker
            key={t.symbol}
            label={t.label}
            snapshot={indexBySymbol[t.symbol]}
          />
        ))}
      </div>

      {/* Preset + Operator + Mode + Env + Clock */}
      <div className="flex items-center gap-2 px-3 border-l border-border">
        <WorkspacePresetSelector />
        <OperatorStatusStrip />
        <span className="h-4 w-px bg-border mx-1" />
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 h-[22px] rounded-sm border text-[10px] font-mono uppercase tracking-wider',
            mode === 'LIVE'
              ? 'text-live border-live/30 bg-down-dim'
              : 'text-paper border-paper/30 bg-info-dim'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              mode === 'LIVE' ? 'bg-live' : 'bg-paper'
            )}
          />
          {mode}
        </span>
        <span className="inline-flex items-center px-2 h-[22px] rounded-sm border border-border bg-panel/60 text-[10px] font-mono uppercase tracking-wider text-text-2">
          {BUILD_ENV}
        </span>
        <span className="inline-flex items-center px-2 h-[22px] rounded-sm border border-border bg-panel/60 text-[10px] font-mono tnum text-text">
          {ist} <span className="text-text-faint ml-1">IST</span>
        </span>
      </div>
    </div>
  )
}
