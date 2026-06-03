'use client'

import { cn } from '@/lib/utils'

type StatusTone = 'green' | 'red' | 'amber' | 'cyan' | 'violet' | 'muted'

const toneMap: Record<StatusTone, string> = {
  green: 'bg-maet-green shadow-[0_0_12px_rgba(22,199,132,0.58)]',
  red: 'bg-maet-red shadow-[0_0_12px_rgba(234,57,67,0.52)]',
  amber: 'bg-maet-amber shadow-[0_0_12px_rgba(245,158,11,0.46)]',
  cyan: 'bg-maet-cyan shadow-[0_0_12px_rgba(34,211,238,0.52)]',
  violet: 'bg-maet-violet shadow-[0_0_12px_rgba(139,92,246,0.46)]',
  muted: 'bg-maet-text-faint',
}

export function StatusOrb({ tone = 'muted', pulse = false, className }: { tone?: StatusTone; pulse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', toneMap[tone], pulse && 'pulse-soft', className)}
    />
  )
}
