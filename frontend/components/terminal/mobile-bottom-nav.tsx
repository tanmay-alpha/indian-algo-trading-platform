'use client'

import {
  Briefcase,
  CandlestickChart,
  Cpu,
  Globe2,
  Notebook,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { WORKSPACES } from '@/lib/constants'
import type { WorkspaceId } from '@/lib/types'
import { cn } from '@/lib/utils'

const ICONS: Record<WorkspaceId, ReactNode> = {
  trade: <CandlestickChart className="w-5 h-5" />,
  markets: <Globe2 className="w-5 h-5" />,
  strategy: <Cpu className="w-5 h-5" />,
  portfolio: <Briefcase className="w-5 h-5" />,
  oms: <ShieldCheck className="w-5 h-5" />,
  journal: <Notebook className="w-5 h-5" />,
}

function navLabel(label: string) {
  if (label === 'Strategy Lab') return 'Lab'
  if (label === 'OMS Blotter') return 'OMS'
  if (label === 'System Journal') return 'Journal'
  return label
}

export function MobileBottomNav() {
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-2/95 border-t border-border/80 backdrop-blur-lg flex items-center justify-around px-2 pb-safe z-30"
      aria-label="Mobile workspace navigation"
    >
      {WORKSPACES.map((workspace) => {
        const active = activeWorkspace === workspace.id
        return (
          <button
            key={workspace.id}
            onClick={() => setWorkspace(workspace.id)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 active:scale-95',
              active ? 'text-info' : 'text-text-dim hover:text-text'
            )}
          >
            <div className={cn(
              'p-1 rounded-md transition-colors',
              active ? 'bg-info/10' : 'bg-transparent'
            )}>
              {ICONS[workspace.id]}
            </div>
            <span className={cn(
              'text-xs font-medium leading-none tracking-tight',
              active ? 'text-info font-semibold' : 'text-text-faint'
            )}>
              {navLabel(workspace.label)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
