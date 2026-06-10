import type { ReactNode } from 'react'

type BadgeVariant = 'paper' | 'up' | 'dn' | 'warn' | 'muted'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  paper: 'border border-accent/35 bg-accent-dim text-accent',
  up: 'border border-up/30 bg-up-dim text-up',
  dn: 'border border-dn/30 bg-dn-dim text-dn',
  warn: 'border border-warn/35 bg-warn-dim text-warn',
  muted: 'border border-border bg-surface text-text-muted',
}

export function Badge({ children, variant = 'paper', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide',
        variants[variant],
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  )
}
