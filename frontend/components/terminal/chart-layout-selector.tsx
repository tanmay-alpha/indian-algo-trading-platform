'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'

export function ChartLayoutSelector() {
  const mode = useTerminalStore((s) => s.chartLayoutMode)
  const setMode = useTerminalStore((s) => s.setChartLayoutMode)

  const modes = [
    { id: 'CLEAN', label: 'CLEAN' },
    { id: 'ANALYSIS', label: 'ANALYSIS' },
    { id: 'FOCUS', label: 'FOCUS' },
  ] as const

  return (
    <div className="flex items-center rounded border border-border bg-panel/30 p-0.5 gap-0.5">
      {modes.map((m) => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              'px-2 h-[20px] rounded-sm text-xs font-mono uppercase tracking-wider transition-colors border',
              active
                ? 'text-info border-info/30 bg-info-dim font-bold'
                : 'border-transparent text-text-dim hover:text-text hover:bg-white/[0.02]'
            )}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
