'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}

export function GlassPanel({ children, className, onClick, hover = false }: GlassPanelProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-panel bg-panel-2/50 border border-border rounded-sm backdrop-blur-md transition-all duration-250',
        hover && 'hover:bg-panel-2/70 hover:border-[#38bdf8]/35 hover:shadow-[0_0_20px_rgba(56,189,248,0.08)]',
        onClick && 'cursor-pointer active:scale-[0.99]',
        className
      )}
    >
      {children}
    </div>
  )
}
