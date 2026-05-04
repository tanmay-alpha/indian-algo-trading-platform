import type { StrategyTemplate } from '@/lib/types'

export function StrategyParameterPanel({
  template,
  params,
  onChange,
}: {
  template?: StrategyTemplate
  params: Record<string, number | string | boolean>
  onChange: (key: string, value: number | string | boolean) => void
}) {
  const entries = Object.entries(template?.params_schema || {})
  return (
    <section className="rounded-sm border border-border bg-panel/60">
      <PanelHeader title="Parameters" subtitle={template?.display_name || 'Select a template'} />
      <div className="grid grid-cols-2 gap-2 p-3">
        {entries.length === 0 ? (
          <div className="col-span-2 text-[10px] font-mono text-text-faint">
            No strategy selected.
          </div>
        ) : (
          entries.map(([key, schema]) => {
            const meta = schema && typeof schema === 'object' ? schema as Record<string, unknown> : {}
            const value = params[key] ?? meta.default ?? ''
            return (
              <label key={key} className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-faint">{key}</span>
                <input
                  type={meta.type === 'integer' || meta.type === 'number' ? 'number' : 'text'}
                  value={String(value)}
                  min={typeof meta.minimum === 'number' ? meta.minimum : undefined}
                  step={meta.type === 'integer' ? 1 : 0.01}
                  onChange={(event) => {
                    const next = event.target.value
                    onChange(key, meta.type === 'integer' || meta.type === 'number' ? Number(next) : next)
                  }}
                  className="h-8 w-full rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text outline-none focus:border-info/50"
                />
              </label>
            )
          })
        )}
      </div>
    </section>
  )
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-border bg-bg/60 px-3 py-2">
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="text-[9px] font-mono text-text-faint">{subtitle}</div>
    </div>
  )
}

