'use client'

import { cn } from '@/lib/utils'

export function EdgeHighlight({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-maet-cyan/70', className)}
    />
  )
}
