'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PremiumCardProps {
  children: ReactNode
  className?: string
  glow?: boolean
  onClick?: () => void
}

export function PremiumCard({ children, className, glow = false, onClick }: PremiumCardProps) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      onClick={onClick}
      {...(onClick ? { type: 'button' } : {})}
      className={cn(
        "w-full rounded-2xl bg-maet-elevated border border-border p-4 relative overflow-hidden transition-all duration-200 text-left block",
        onClick && "hover:bg-white/[0.065] active:scale-[0.985] cursor-pointer",
        glow && "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-info before:pointer-events-none",
        className
      )}
    >
      {children}
    </Component>
  )
}
