'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface PremiumGlowBorderProps {
  children: ReactNode
  className?: string
  containerClassName?: string
  glowColor?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose'
}

export function PremiumGlowBorder({
  children,
  className,
  containerClassName,
  glowColor = 'cyan',
}: PremiumGlowBorderProps) {
  return (
    <div
      data-glow={glowColor}
      className={cn(
        'relative rounded-xl p-[1px] overflow-hidden group transition-all duration-300',
        containerClassName
      )}
    >
      {/* Internal Content card wrapper */}
      <div
        className={cn(
          'w-full h-full bg-bg-surface/95 rounded-[11px] overflow-hidden z-10',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
