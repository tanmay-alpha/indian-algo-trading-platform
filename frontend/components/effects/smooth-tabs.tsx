'use client'

import { cn } from '@/lib/utils'

interface SmoothTabsProps<T extends string> {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function SmoothTabs<T extends string>({ tabs, active, onChange, className }: SmoothTabsProps<T>) {
  return (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn('glass-tab maet-press', active === tab.id && 'active')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
