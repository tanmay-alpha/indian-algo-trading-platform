'use client'

export function SafetyStrip() {
  return (
    <div
      className="sticky top-0 z-[80] flex h-safety items-center justify-center border-b border-safety-locked/20 bg-safety-locked/[0.06] px-3 font-mono text-[11px] text-maet-text-muted"
      role="status"
      aria-label="Live trading locked, paper mode, read only"
    >
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-safety-locked shadow-[0_0_10px_rgba(255,77,106,0.8)] pulse-soft" />
        <span className="truncate">
          LIVE LOCKED <span className="text-maet-border-strong">.</span> PAPER MODE <span className="text-maet-border-strong">.</span> READ ONLY
        </span>
      </div>
    </div>
  )
}
