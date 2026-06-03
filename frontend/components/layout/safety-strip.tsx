'use client'

import type { ReactNode } from 'react'
import { StatusOrb } from '@/components/effects/status-orb'

export function SafetyStrip() {
  return (
    <div
      className="sticky top-0 z-[80] flex min-h-safety items-center justify-center border-b border-maet-amber/20 bg-maet-ink-950/106 px-3 py-1 text-xs font-extrabold text-maet-text-soft shadow-inner backdrop-blur-xl md:h-safety md:py-0"
      role="status"
      aria-label="Live trading locked, paper mode, read only, AI advisory only, broker mutation disabled"
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <StatusOrb tone="amber" pulse />
        <SafetyText>LIVE LOCKED</SafetyText>
        <SafetyText>PAPER MODE</SafetyText>
        <SafetyText>READ ONLY</SafetyText>
        <SafetyText>AI ADVISORY ONLY</SafetyText>
        <SafetyText>BROKER MUTATION DISABLED</SafetyText>
      </div>
    </div>
  )
}

function SafetyText({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap after:ml-3 after:text-maet-text-faint after:content-['/'] last:after:content-none">
      {children}
    </span>
  )
}
