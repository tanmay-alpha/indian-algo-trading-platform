'use client'

import {
  Activity,
  BarChart2,
  Brain,
  Briefcase,
  Home,
  List,
  ShieldCheck,
} from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { id: AppTab; label: string; sub: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', sub: 'Overview', Icon: Home },
  { id: 'watchlist', label: 'Watchlist', sub: 'Symbols', Icon: List },
  { id: 'chart', label: 'Chart', sub: 'Workspace', Icon: BarChart2 },
  { id: 'portfolio', label: 'Portfolio', sub: 'Read-only', Icon: Briefcase },
  { id: 'ai', label: 'AI Advisory', sub: 'Passive', Icon: Brain },
  { id: 'system', label: 'System', sub: 'Health', Icon: Activity },
]

interface DesktopSidebarProps {
  active: AppTab
  onNavigate: (tab: AppTab) => void
}

export function DesktopSidebar({ active, onNavigate }: DesktopSidebarProps) {
  return (
    <aside className="flex h-dvh w-[248px] shrink-0 flex-col border-r border-white/[0.08] bg-[#071018]/95 px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0EA5E9] text-base font-extrabold text-[#071018] shadow-cyan">
          M
        </div>
        <div className="min-w-0">
          <div className="text-base font-extrabold leading-tight text-text">MAET Terminal</div>
          <div className="text-xs font-medium text-text-dim">Paper trading workspace</div>
        </div>
      </div>

      <nav className="space-y-1.5" aria-label="Desktop navigation">
        {NAV_ITEMS.map(({ id, label, sub, Icon }) => {
          const selected = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-label={`Open ${label} section`}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60',
                selected
                  ? 'border-info/30 bg-info/10 text-text shadow-cyan'
                  : 'border-transparent text-text-dim hover:border-white/[0.08] hover:bg-white/[0.045] hover:text-text'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', selected ? 'text-info' : 'text-text-faint')} />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">{label}</span>
                <span className="block text-xs leading-tight text-text-faint">{sub}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-down/20 bg-down/5 p-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-down">
          <ShieldCheck className="h-4 w-4" />
          LIVE LOCKED
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-dim">
          Paper mode, broker read-only sync, and AI advisory-only states remain enforced in the UI.
        </p>
      </div>
    </aside>
  )
}
