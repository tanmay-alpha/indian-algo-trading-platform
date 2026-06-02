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
  const backendOnline = apiStatus === 'ONLINE'

  return (
    <aside className="group flex h-full w-14 shrink-0 flex-col border-r border-maet-border bg-maet-void px-2 py-3 transition-[width] duration-150 hover:w-[200px]">
      <div className="mb-5 flex h-10 items-center gap-3 overflow-hidden px-1">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-maet-blue font-heading text-base font-extrabold text-white shadow-cyan">
          M
        </div>
        <div className="min-w-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
          <div className="truncate font-heading text-sm font-bold leading-tight text-maet-text">MAET Terminal</div>
          <div className="truncate font-mono text-[11px] text-maet-text-muted">Paper workspace</div>
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
              className={cn(
                'relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-md border border-transparent px-2 text-left transition-colors',
                selected
                  ? 'bg-maet-elevated text-maet-text before:absolute before:left-0 before:top-1 before:h-9 before:w-0.5 before:rounded-full before:bg-maet-blue'
                  : 'text-maet-text-secondary hover:bg-maet-surface hover:text-maet-text'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', selected ? 'text-maet-blue' : 'text-maet-text-muted')} />
              <span className="truncate text-sm font-bold opacity-0 transition-opacity duration-100 group-hover:opacity-100">{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto overflow-hidden rounded-md border border-maet-border bg-maet-surface p-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', backendOnline ? 'bg-maet-green shadow-[0_0_10px_rgba(0,214,143,0.7)]' : 'bg-maet-red')} />
          <div className="min-w-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
            <div className="truncate font-mono text-[11px] font-bold text-maet-text">{backendOnline ? 'Backend up' : 'Backend down'}</div>
            <div className="truncate text-[11px] text-maet-text-muted">System status</div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid h-8 place-items-center rounded-md text-maet-text-muted opacity-100 transition-opacity group-hover:opacity-0">
        <Menu className="h-4 w-4" />
      </div>
    </aside>
  )
}
