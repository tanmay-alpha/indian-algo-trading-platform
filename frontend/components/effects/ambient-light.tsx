'use client'

import { cn } from '@/lib/utils'

type AmbientTone = 'cyan' | 'blue' | 'violet' | 'amber'

const tones: Record<AmbientTone, string> = {
  cyan: 'from-maet-cyan/20 via-maet-blue/10 to-transparent',
  blue: 'from-maet-blue/20 via-maet-cyan/10 to-transparent',
  violet: 'from-maet-violet/20 via-maet-blue/10 to-transparent',
  amber: 'from-maet-amber/20 via-maet-blue/10 to-transparent',
}

export function AmbientLight({ tone = 'cyan', className }: { tone?: AmbientTone; className?: string }) {
  return (
    <div
      className={cn(
        'absolute inset-x-[-10%] h-[36rem] bg-gradient-to-b blur-3xl',
        tones[tone],
        className
      )}
    />
  )
}
