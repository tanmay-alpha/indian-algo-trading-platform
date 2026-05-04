import { LineChart } from 'lucide-react'

export function IndicatorEmptyState({
  title,
  hint,
}: {
  title: string
  hint: string
}) {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="w-[420px] rounded-lg border border-border-strong bg-bg-2/92 shadow-panel pointer-events-auto">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-text">
            <LineChart className="w-4 h-4 text-info" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <p className="mt-1 text-xs text-text-dim leading-relaxed">{hint}</p>
        </div>
      </div>
    </div>
  )
}
