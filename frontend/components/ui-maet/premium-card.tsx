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
        "w-full rounded-2xl bg-white/[0.045] border border-white/[0.08] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)] relative overflow-hidden transition-all duration-200 text-left block",
        onClick && "hover:bg-white/[0.065] active:scale-[0.985] cursor-pointer",
        glow && "before:absolute before:inset-0 before:bg-gradient-to-br before:from-info/5 before:to-transparent before:pointer-events-none",
        className
      )}
    >
      {children}
    </Component>
  )
}
