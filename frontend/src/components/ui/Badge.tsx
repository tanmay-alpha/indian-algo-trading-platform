import type { ReactNode } from 'react'

type BadgeVariant = 'paper' | 'up' | 'dn' | 'warn'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  paper: 'border-accent bg-transparent text-accent',
  up: 'border-up bg-up text-[var(--color-bg-base)]',
  dn: 'border-dn bg-dn text-[var(--color-bg-base)]',
  warn: 'border-warn bg-warn text-[var(--color-bg-base)]',
}

export function Badge({ children, variant = 'paper', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex h-5 items-center rounded-sm border px-2 font-mono text-[10px] font-medium uppercase leading-none tracking-normal',
        variants[variant],
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  )
}
