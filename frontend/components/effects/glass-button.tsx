'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'neutral' | 'danger'
}

export function GlassButton({
  children,
  className,
  variant = 'neutral',
  type = 'button',
  ...props
}: GlassButtonProps) {
  const variantClass = {
    primary: 'maet-btn-primary',
    neutral: 'glass-button',
    danger: 'border-maet-red/40 bg-maet-red/10 text-maet-red hover:border-maet-red/100',
  }[variant]

  return (
    <button type={type} className={cn('tap-scale', variantClass, className)} {...props}>
      {children}
    </button>
  )
}
