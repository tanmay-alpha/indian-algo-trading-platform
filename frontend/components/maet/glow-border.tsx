'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlowBorderProps {
  children: ReactNode
  className?: string
  glowColor?: 'cyan' | 'green' | 'red' | 'yellow' | 'purple'
  active?: boolean
}

export function GlowBorder({
  children,
  className,
  glowColor = 'cyan',
  active = true,
}: GlowBorderProps) {
  const glowClasses = {
    cyan: 'shadow-[0_0_15px_rgba(56,189,248,0.12)] border-[#38bdf8]/30',
    green: 'shadow-[0_0_15px_rgba(34,197,94,0.12)] border-up/30',
    red: 'shadow-[0_0_15px_rgba(239,68,68,0.12)] border-down/30',
    yellow: 'shadow-[0_0_15px_rgba(234,179,8,0.12)] border-warn/30',
    purple: 'shadow-[0_0_15px_rgba(168,85,247,0.12)] border-[#a855f7]/30',
  }

  return (
    <div
      className={cn(
        'relative rounded-sm border border-border transition-all duration-300',
        active && glowClasses[glowColor],
        className
      )}
    >
      {children}
    </div>
  )
}
