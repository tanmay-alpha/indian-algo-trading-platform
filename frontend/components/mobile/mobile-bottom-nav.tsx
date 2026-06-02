'use client'

import { Home, List, BarChart2, Briefcase, Brain, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppTab = 'home' | 'watchlist' | 'chart' | 'portfolio' | 'ai' | 'system'

const TABS: { id: AppTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home',      label: 'Home',      Icon: Home       },
  { id: 'watchlist', label: 'Watch',     Icon: List       },
  { id: 'chart',     label: 'Chart',     Icon: BarChart2  },
  { id: 'portfolio', label: 'Portfolio', Icon: Briefcase  },
  { id: 'ai',        label: 'AI',        Icon: Brain      },
  { id: 'system',    label: 'System',    Icon: Activity   },
]

interface MobileBottomNavProps {
  active: AppTab
  onNavigate: (tab: AppTab) => void
}

export function MobileBottomNav({ active, onNavigate }: MobileBottomNavProps) {
  return (
    <nav
      className="bottom-nav flex items-stretch justify-around px-1 z-40 shrink-0"
      aria-label="Main navigation"
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
              'flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-150 active:scale-90 min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60',
              isActive ? 'text-info' : 'text-text-dim'
            )}
            type="button"
          >
            <div className={cn(
              'w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-150',
              isActive ? 'bg-info/12' : 'bg-transparent'
            )}>
              <Icon className={cn('w-[18px] h-[18px]', isActive ? 'text-info' : 'text-text-dim')} />
            </div>
            <span className={cn(
              'text-[9px] sm:text-[10px] leading-none font-medium tracking-tight truncate max-w-full',
              isActive ? 'text-info' : 'text-text-faint'
            )}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
