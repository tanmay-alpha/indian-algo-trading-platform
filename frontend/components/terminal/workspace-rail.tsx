'use client'

import {
  CandlestickChart,
  Globe2,
  LineChart,
  Briefcase,
  Cpu,
  ShieldCheck,
  Notebook,
  Command,
  Keyboard,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { WORKSPACES } from '@/lib/constants'
import type { WorkspaceId } from '@/lib/types'
import { cn } from '@/lib/utils'

const ICONS: Record<WorkspaceId, ReactNode> = {
  trade: <CandlestickChart className="w-4 h-4" />,
  markets: <Globe2 className="w-4 h-4" />,
  charts: <LineChart className="w-4 h-4" />,
  portfolio: <Briefcase className="w-4 h-4" />,
  strategy: <Cpu className="w-4 h-4" />,
  risk: <ShieldCheck className="w-4 h-4" />,
  journal: <Notebook className="w-4 h-4" />,
}

export function WorkspaceRail() {
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const togglePalette = useTerminalStore((s) => s.toggleCommandPalette)
  const toggleShortcuts = useTerminalStore((s) => s.toggleShortcuts)

  return (
    <nav
      className="w-rail shrink-0 h-full border-r border-border bg-bg-2 flex flex-col items-stretch"
      aria-label="Workspace navigation"
    >
      {/* Logo dot */}
      <div className="h-topbar flex items-center justify-center border-b border-border">
        <div className="w-7 h-7 grid place-items-center rounded-sm bg-info/10 border border-info/30 text-info font-mono text-[10px] font-bold tracking-tighter">
          M·OS
        </div>
      </div>

      {/* Workspace items */}
      <ul className="flex-1 py-2 flex flex-col gap-0.5">
        {WORKSPACES.map((w) => {
          const active = activeWorkspace === w.id
          return (
            <li key={w.id}>
              <button
                onClick={() => setWorkspace(w.id)}
                className={cn(
                  'group relative w-full h-10 flex flex-col items-center justify-center gap-0.5',
                  'text-text-dim hover:text-text hover:bg-white/[0.03] transition-colors',
                  active && 'text-info bg-info/[0.08]'
                )}
                title={`${w.label} · ${w.shortcut}`}
              >
                {/* Active accent line */}
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-info" />
                )}
                {ICONS[w.id]}
                <span
                  className={cn(
                    'text-[8.5px] font-mono uppercase tracking-wider',
                    active ? 'text-info' : 'text-text-faint group-hover:text-text-dim'
                  )}
                >
                  {w.short}
                </span>
                <span className="absolute right-1 top-1 text-[8px] font-mono text-text-faint">
                  {w.shortcut}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Bottom utilities */}
      <div className="border-t border-border py-2 flex flex-col gap-0.5">
        <button
          onClick={() => togglePalette(true)}
          className="h-9 flex flex-col items-center justify-center gap-0.5 text-text-dim hover:text-info hover:bg-white/[0.03]"
          title="Command palette · Ctrl K"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="text-[8.5px] font-mono uppercase tracking-wider">CMD</span>
        </button>
        <button
          onClick={() => toggleShortcuts(true)}
          className="h-9 flex flex-col items-center justify-center gap-0.5 text-text-dim hover:text-info hover:bg-white/[0.03]"
          title="Keyboard shortcuts · ?"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span className="text-[8.5px] font-mono uppercase tracking-wider">KEY</span>
        </button>
      </div>
    </nav>
  )
}
