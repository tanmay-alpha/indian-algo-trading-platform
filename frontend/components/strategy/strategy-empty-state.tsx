import type { ReactNode } from 'react'

export function StrategyEmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: ReactNode
}) {
  return (
    <div className="grid min-h-[120px] place-items-center rounded-sm border border-border bg-panel/50 p-4 text-center">
      <div>
        <div className="text-xs font-semibold text-text">{title}</div>
        <div className="mt-1 max-w-md text-[10px] font-mono text-text-faint">{hint}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}

