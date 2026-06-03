import type { StrategyTemplate } from '@/lib/types'
import { cn } from '@/lib/utils'

export function StrategyTemplateCards({
  templates,
  selected,
  onSelect,
}: {
  templates: StrategyTemplate[]
  selected: string | null
  onSelect: (strategyName: string) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {templates.map((template) => {
        const active = selected === template.strategy_name
        return (
          <button
            key={template.strategy_name}
            onClick={() => onSelect(template.strategy_name)}
            className={cn(
              'min-h-[118px] rounded-sm border bg-panel/65 p-3 text-left transition-colors',
              active
                ? 'border-info/50 bg-info-dim/40'
                : 'border-border hover:border-border-strong hover:bg-panel'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold text-text">{template.display_name}</div>
              <span className="rounded border border-warn/25 bg-warn-dim px-1.5 py-0.5 text-xs font-mono text-warn">
                RESEARCH
              </span>
            </div>
            <div className="mt-2 line-clamp-3 text-xs leading-4 text-text-dim">
              {template.description}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {template.required_indicators.map((indicator) => (
                <span
                  key={indicator}
                  className="rounded border border-border bg-bg px-1.5 py-0.5 text-xs font-mono uppercase text-text-faint"
                >
                  {indicator.replace('_', ' ')}
                </span>
              ))}
              {!template.live_execution_enabled && (
                <span className="rounded border border-border bg-bg px-1.5 py-0.5 text-xs font-mono text-text-faint">
                  LIVE OFF
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

