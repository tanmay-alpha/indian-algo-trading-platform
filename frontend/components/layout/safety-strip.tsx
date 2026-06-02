'use client'

import type { ReactNode } from 'react'

export function SafetyStrip() {
  return (
    <div
      className="sticky top-0 z-[80] flex min-h-safety items-center justify-center border-b border-maet-glass-border bg-maet-bg-deep/72 px-3 py-1 font-mono text-[10px] text-maet-text-muted shadow-inner backdrop-blur-xl md:h-safety md:py-0 md:text-[11px]"
      role="status"
      aria-label="Live trading locked, paper mode, read only, AI advisory only, broker mutation disabled"
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-safety-locked shadow-[0_0_10px_rgba(255,77,106,0.8)] pulse-soft" />
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
    <span className="whitespace-nowrap text-maet-text-soft after:ml-2 after:text-maet-text-faint after:content-['.'] last:after:content-none">
      {children}
    </span>
  )
}
