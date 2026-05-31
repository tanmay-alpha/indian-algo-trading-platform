'use client'

import {
  Briefcase,
  CandlestickChart,
  Command,
  Cpu,
  Eye,
  Globe2,
  Keyboard,
  Lock,
  Notebook,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { WORKSPACES } from '@/lib/constants'
import type { WorkspaceId } from '@/lib/types'
import { cn } from '@/lib/utils'

const ICONS: Record<WorkspaceId, ReactNode> = {
  trade: <CandlestickChart className="w-4 h-4" />,
  markets: <Globe2 className="w-4 h-4" />,
  strategy: <Cpu className="w-4 h-4" />,
  portfolio: <Briefcase className="w-4 h-4" />,
  oms: <ShieldCheck className="w-4 h-4" />,
  journal: <Notebook className="w-4 h-4" />,
}

function railLabel(label: string) {
  if (label === 'Strategy Lab') return 'Lab'
  if (label === 'OMS Blotter') return 'OMS'
  if (label === 'System Journal') return 'Journal'
  return label
}

export function WorkspaceRail() {
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const togglePalette = useTerminalStore((s) => s.toggleCommandPalette)
  const toggleShortcuts = useTerminalStore((s) => s.toggleShortcuts)

  return (
    <nav
      className="hidden md:flex w-rail shrink-0 h-full border-r border-[#38bdf8]/10 bg-bg-2/80 backdrop-blur-md flex-col items-stretch glass-panel"
      aria-label="Workspace navigation"
    >
      <div className="h-topbar flex items-center justify-center border-b border-border bg-panel/40">
        <div className="w-9 h-8 grid place-items-center rounded-md bg-info/10 border border-info/25 text-info font-mono text-[10px] font-bold tracking-tight">
          MAET
        </div>
      </div>

      <ul className="flex-1 py-2 flex flex-col gap-1">
        {WORKSPACES.map((workspace) => {
          const active = activeWorkspace === workspace.id
          return (
            <li key={workspace.id}>
              <button
                onClick={() => setWorkspace(workspace.id)}
                className={cn(
                  'group relative mx-1 h-[50px] rounded-md flex flex-col items-center justify-center gap-1',
                  'text-text-dim hover:text-text hover:bg-white/[0.04] transition-colors',
                  active &&
                    'text-info bg-info/[0.10] shadow-[inset_0_0_0_1px_rgba(84,193,236,0.10)]'
                )}
                title={`${workspace.label} / ${workspace.shortcut}`}
              >
                {active && (
                  <span className="absolute left-[-4px] top-2 bottom-2 w-[2px] rounded-r bg-info" />
                )}
                {ICONS[workspace.id]}
                <span
                  className={cn(
                    'max-w-[58px] truncate text-[9px] font-medium leading-none',
                    active ? 'text-info' : 'text-text-dim group-hover:text-text-2'
                  )}
                >
                  {railLabel(workspace.label)}
                </span>
                <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded border border-border bg-bg text-[8px] font-mono text-text-faint">
                  {workspace.shortcut}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="border-t border-border py-2 flex flex-col gap-1">
        {/* Safety Indicators */}
        <div className="flex flex-col items-center gap-1.5 py-2 border-b border-border/40">
          <div 
            className="w-7 h-7 rounded flex items-center justify-center bg-locked/10 border border-locked/30 text-locked cursor-help"
            title="LIVE LOCKED: Hardened code-level lock enabled. Real order execution is physically restricted."
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div 
            className="w-7 h-7 rounded flex items-center justify-center bg-info/10 border border-info/30 text-info cursor-help"
            title="PAPER / READ ONLY: Simulated execution and read-only broker data sync."
          >
            <Eye className="w-3.5 h-3.5" />
          </div>
          <div 
            className="w-7 h-7 rounded flex items-center justify-center bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#c084fc] cursor-help"
            title="BROKER MUTATION DISABLED: Broker integrations are read-only; mutation actions are bypassed."
          >
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div 
            className="w-7 h-7 rounded flex items-center justify-center bg-warn/10 border border-warn/30 text-warn cursor-help"
            title="AI ADVISORY ONLY: AI models act in a passive advisory capacity. No automated executions."
          >
            <Cpu className="w-3.5 h-3.5" />
          </div>
        </div>

        <button
          onClick={() => togglePalette(true)}
          className="mx-1 h-10 rounded-md flex flex-col items-center justify-center gap-0.5 text-text-dim hover:text-info hover:bg-white/[0.04]"
          title="Command palette / Ctrl K"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="text-[8.5px] font-mono uppercase tracking-wider">CMD</span>
        </button>
        <button
          onClick={() => toggleShortcuts(true)}
          className="mx-1 h-10 rounded-md flex flex-col items-center justify-center gap-0.5 text-text-dim hover:text-info hover:bg-white/[0.04]"
          title="Keyboard shortcuts / ?"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span className="text-[8.5px] font-mono uppercase tracking-wider">KEY</span>
        </button>
      </div>
    </nav>
  )
}
