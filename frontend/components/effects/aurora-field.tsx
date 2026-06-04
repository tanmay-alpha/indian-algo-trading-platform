'use client'

import { cn } from '@/lib/utils'

interface AuroraFieldProps {
  className?: string
  intensity?: 'calm' | 'standard' | 'strong'
  tone?: 'blue' | 'cyan' | 'green'
}

export function AuroraField({
  className,
  intensity = 'standard',
  tone = 'blue',
}: AuroraFieldProps) {
  const opacity = {
    calm: 'opacity-45',
    standard: 'opacity-65',
    strong: 'opacity-80',
  }[intensity]

  return (
    <div
      aria-hidden="true"
      data-effect="aurora-field"
      data-tone={tone}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', opacity, className)}
    >
      <div className="absolute inset-0 bg-maet-base" />
    </div>
  )
}
