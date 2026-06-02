'use client'

import { cn } from '@/lib/utils'

export interface GlassTabItem<T extends string> {
  label: string
  value: T
}

interface GlassTabsProps<T extends string> {
  items: GlassTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function GlassTabs<T extends string>({ items, value, onChange, className }: GlassTabsProps<T>) {
  return (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto', className)} role="tablist">
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn('glass-tab', selected && 'active')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
