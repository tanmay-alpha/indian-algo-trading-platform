'use client'

import { cn } from '@/lib/utils'

interface AuroraFieldProps {
  className?: string
  intensity?: 'calm' | 'standard' | 'strong'
  tone?: 'blue' | 'cyan' | 'green'
}

const toneGradients = {
  blue: {
    primary: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.24), transparent 64%)',
    secondary: 'linear-gradient(105deg, transparent 10%, rgba(37,99,235,0.18) 38%, rgba(139,92,246,0.10) 58%, transparent 82%)',
  },
  cyan: {
    primary: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.24), transparent 64%)',
    secondary: 'linear-gradient(105deg, transparent 10%, rgba(56,189,248,0.17) 38%, rgba(22,199,132,0.10) 58%, transparent 82%)',
  },
  green: {
    primary: 'radial-gradient(ellipse at 50% 0%, rgba(22,199,132,0.18), transparent 64%)',
    secondary: 'linear-gradient(105deg, transparent 10%, rgba(34,211,238,0.15) 38%, rgba(22,199,132,0.12) 58%, transparent 82%)',
  },
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
  const gradients = toneGradients[tone]

  return (
    <div
      aria-hidden="true"
      data-effect="aurora-field"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen', opacity, className)}
    >
      <div
        className="absolute -inset-x-24 -top-36 h-[420px] blur-3xl"
        style={{ background: gradients.primary }}
      />
      <div
        className="absolute inset-x-[-12%] top-8 h-52 rotate-[-4deg] blur-2xl"
        style={{ background: gradients.secondary }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(2,6,23,0.44)_72%,rgba(2,6,23,0.70))]" />
    </div>
  )
}
