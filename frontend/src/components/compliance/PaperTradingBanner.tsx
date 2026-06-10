import { AlertTriangle } from 'lucide-react'

export function PaperTradingBanner() {
  return (
    <div
      className="flex min-h-8 shrink-0 items-center justify-center gap-2 border-b border-warn/25 bg-warn/10 px-3 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wide text-warn"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Paper trading only</span>
      <span className="hidden sm:inline">No real money orders. Not SEBI registered. No investment advice.</span>
    </div>
  )
}
