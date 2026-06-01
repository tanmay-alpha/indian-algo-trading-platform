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
  const glowGradients = {
    cyan: 'from-cyan-500 via-blue-500 to-transparent',
    purple: 'from-purple-500 via-pink-500 to-transparent',
    emerald: 'from-emerald-500 via-teal-500 to-transparent',
    amber: 'from-amber-500 via-orange-500 to-transparent',
    rose: 'from-rose-500 via-red-500 to-transparent',
  }

  return (
    <div
      className={cn(
        'relative rounded-xl p-[1px] overflow-hidden group transition-all duration-300',
        containerClassName
      )}
    >
      {/* Animated glow gradient background border */}
      <div
        className={cn(
          'absolute -inset-[100%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] opacity-35 group-hover:opacity-100 group-hover:animate-[spin_4s_linear_infinite] transition-opacity duration-500 -z-10',
          glowGradients[glowColor]
        )}
      />
      
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
