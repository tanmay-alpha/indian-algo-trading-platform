'use client'

import { Home, List, BarChart2, Briefcase, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppTab = 'home' | 'watchlist' | 'chart' | 'portfolio' | 'ai' | 'system'

const TABS: { id: Exclude<AppTab, 'system'>; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home',      label: 'Home',      Icon: Home       },
  { id: 'watchlist', label: 'Watchlist', Icon: List       },
  { id: 'chart',     label: 'Chart',     Icon: BarChart2  },
  { id: 'portfolio', label: 'Portfolio', Icon: Briefcase  },
  { id: 'ai',        label: 'AI',        Icon: Brain      },
]

interface MobileBottomNavProps {
  active: AppTab
  onNavigate: (tab: AppTab) => void
}

export function MobileBottomNav({ active, onNavigate }: MobileBottomNavProps) {
  return (
    <nav
      className="bottom-nav mobile-bottom-nav-fixed z-40 mx-3 mb-3 flex shrink-0 items-stretch justify-around rounded-3xl px-1.5 py-1"
      aria-label="Main navigation"
      style={{ minHeight: 'var(--bottom-nav-h, 64px)' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-label={`Open ${label} screen`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition-all duration-150 active:scale-95',
              'min-h-[48px]', // Touch target accessibility
              isActive ? 'text-maet-blue' : 'text-maet-text-muted'
            )}
            type="button"
          >
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-2xl transition-all duration-150',
              isActive ? 'border border-maet-glass-border-strong bg-maet-blue/20 shadow-cyan' : 'bg-transparent'
            )}>
              <Icon className={cn('h-4 w-4', isActive ? 'text-maet-blue' : 'text-maet-text-muted')} />
            </div>
            <span className={cn(
              'max-w-full truncate text-[10px] font-medium leading-tight',
              isActive ? 'text-maet-blue' : 'text-maet-text-muted'
            )}>
              {label}
            </span>
            {isActive && (
              <span
                className="absolute bottom-0.5 h-[2px] w-5 rounded-full bg-maet-cyan"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
