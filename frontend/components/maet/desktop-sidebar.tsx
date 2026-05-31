'use client'

import {
  Briefcase,
  CandlestickChart,
  Cpu,
  Globe2,
  Lock,
  Eye,
  Notebook,
  ShieldCheck,
  Command,
  Keyboard
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

function sidebarLabel(label: string) {
  if (label === 'Strategy Lab') return 'Lab'
  if (label === 'OMS Blotter') return 'OMS'
  if (label === 'System Journal') return 'Journal'
  return label
}

export function DesktopSidebar() {
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const togglePalette = useTerminalStore((s) => s.toggleCommandPalette)
  const toggleShortcuts = useTerminalStore((s) => s.toggleShortcuts)

  return (
    <nav
      className="hidden md:flex w-16 shrink-0 h-full border-r border-white/[0.06] bg-[#07090e]/90 backdrop-blur-md flex-col items-center py-4 justify-between z-25"
      aria-label="Desktop Workspace navigation"
    >
      {/* Brand logo wrapper */}
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-mono font-bold text-white shadow-lg shadow-cyan-500/20 text-xs">
          M
        </div>

        {/* Navigation list */}
        <ul className="flex flex-col gap-2 w-full px-1.5">
          {WORKSPACES.map((ws) => {
            const active = activeWorkspace === ws.id
            return (
              <li key={ws.id} className="w-full">
                <button
                  onClick={() => setWorkspace(ws.id)}
                  className={cn(
                    'group relative w-full h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-200',
                    active
                      ? 'bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5'
                      : 'text-text-dim hover:text-white hover:bg-white/[0.03] border border-transparent'
                  )}
                  title={`${ws.label} (${ws.shortcut})`}
                >
                  {active && (
                    <span className="absolute left-[-6px] top-3 bottom-3 w-[3px] rounded-r bg-cyan-400" />
                  )}
                  {ICONS[ws.id]}
                  <span
                    className={cn(
                      'text-[9px] font-medium leading-none tracking-tight',
                      active ? 'text-cyan-400 font-semibold' : 'text-text-faint'
                    )}
                  >
                    {sidebarLabel(ws.label)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Safety Group & Controls */}
      <div className="flex flex-col items-center gap-4 w-full px-2">
        {/* Compact Vertical Badges indicator */}
        <div className="flex flex-col items-center gap-1.5 py-2 w-full border-t border-b border-white/[0.04]">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 cursor-help"
            title="LIVE LOCKED"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 cursor-help"
            title="PAPER ONLY"
          >
            <Eye className="w-3.5 h-3.5" />
          </div>
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400 cursor-help"
            title="MUTATION LOCKED"
          >
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-400 cursor-help"
            title="AI ADVISORY ONLY"
          >
            <Cpu className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Action icons */}
        <button
          onClick={() => togglePalette(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-dim hover:text-cyan-400 hover:bg-white/[0.04] transition-colors"
          title="Command Palette (Ctrl+K)"
        >
          <Command className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleShortcuts(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-dim hover:text-cyan-400 hover:bg-white/[0.04] transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>
      </div>
    </nav>
  )
}
