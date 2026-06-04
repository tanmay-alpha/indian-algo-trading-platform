'use client'

import {
  Activity,
  BarChart2,
  Brain,
  Briefcase,
  Home,
  List,
  Menu,
} from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { id: AppTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'watchlist', label: 'Watchlist', Icon: List },
  { id: 'chart', label: 'Chart', Icon: BarChart2 },
  { id: 'portfolio', label: 'Portfolio', Icon: Briefcase },
  { id: 'ai', label: 'AI', Icon: Brain },
  { id: 'system', label: 'System', Icon: Activity },
]

interface DesktopSidebarProps {
  active: AppTab
  onNavigate: (tab: AppTab) => void
}

export function DesktopSidebar({ active, onNavigate }: DesktopSidebarProps) {
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const dataOnline = apiStatus === 'ONLINE'

  return (
    <aside className="m-3 mr-0 flex h-[calc(100%-24px)] w-[72px] shrink-0 flex-col rounded-2xl border border-maet-glass-border bg-maet-bg-deep/70 px-2 py-3 shadow-glass backdrop-blur-2xl">
      <div className="mb-5 flex h-10 items-center gap-3 overflow-hidden px-1">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-maet-glass-border bg-maet-blue/80 font-heading text-base font-extrabold text-white shadow-cyan">
          M
        </div>
        <div className="sr-only">
          <div className="truncate font-heading text-sm font-bold leading-tight text-maet-text">MAET Terminal</div>
          <div className="truncate text-xs font-semibold text-maet-text-muted">Paper workspace</div>
        </div>
      </div>

      <nav className="space-y-1.5" aria-label="Desktop navigation">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-label={`Open ${label} section`}
              aria-current={selected ? 'page' : undefined}
              title={label}
              className={cn(
                'relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl border border-transparent px-2 text-left transition-all',
                selected
                  ? 'border-maet-glass-border-strong bg-maet-glass-2 text-maet-text shadow-inner before:absolute before:left-0 before:top-1 before:h-9 before:w-0.5 before:rounded-full before:bg-maet-cyan'
                  : 'text-maet-text-secondary hover:border-maet-glass-border hover:bg-maet-glass-1 hover:text-maet-text'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', selected ? 'text-maet-blue' : 'text-maet-text-muted')} />
              <span className="sr-only">{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto overflow-hidden rounded-2xl border border-maet-glass-border bg-maet-glass-1 p-2 shadow-inner">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dataOnline ? 'bg-maet-green shadow-[0_0_10px_rgba(0,214,143,0.7)]' : 'bg-maet-amber pulse-soft')} />
          <div className="sr-only">
            <div className="truncate font-mono text-xs font-bold text-maet-text">{dataOnline ? 'Market data connected' : 'Market data connecting'}</div>
            <div className="truncate text-xs text-maet-text-muted">Connection status</div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid h-8 place-items-center rounded-xl text-maet-text-muted">
        <Menu className="h-4 w-4" />
      </div>
    </aside>
  )
}
