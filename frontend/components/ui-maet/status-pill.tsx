'use client'

import { cn } from '@/lib/utils'

interface StatusPillProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default'
  children: React.ReactNode
  className?: string
}

export function StatusPill({ variant = 'default', children, className }: StatusPillProps) {
  const variantStyles = {
    success: 'bg-[#16C784]/10 text-[#16C784] border-[#16C784]/20',
    danger: 'bg-[#EA3943]/10 text-[#EA3943] border-[#EA3943]/20',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    info: 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/20',
    default: 'bg-white/[0.04] text-text-dim border-white/[0.08]',
  }[variant]

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border tracking-wider uppercase font-mono",
      variantStyles,
      className
    )}>
      {children}
    </span>
  )
}
