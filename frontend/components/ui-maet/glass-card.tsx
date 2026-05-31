'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function GlassCard({ children, className, onClick }: GlassCardProps) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl bg-white/[0.025] border border-white/[0.06] backdrop-blur-md -webkit-backdrop-blur-md p-4 shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-200 text-left block",
        onClick && "hover:bg-white/[0.045] active:scale-[0.985] cursor-pointer",
        className
      )}
    >
      {children}
    </Component>
  )
}
