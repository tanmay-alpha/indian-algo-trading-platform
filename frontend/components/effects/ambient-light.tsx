'use client'

import { cn } from '@/lib/utils'

type AmbientTone = 'cyan' | 'blue' | 'violet' | 'amber'

export function AmbientLight({ tone = 'cyan', className }: { tone?: AmbientTone; className?: string }) {
  return (
    <div
      data-tone={tone}
      className={cn('absolute inset-x-[-10%] h-[36rem] pointer-events-none', className)}
    />
  )
}
