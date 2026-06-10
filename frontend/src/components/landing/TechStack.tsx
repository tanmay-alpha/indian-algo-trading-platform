const stack = [
  { name: 'Next.js 15', color: '#E8E6DF' },
  { name: 'FastAPI', color: '#4ADE80' },
  { name: 'C++17 Engine', color: '#F0C040' },
  { name: 'pybind11', color: '#F0C040' },
  { name: 'Angel One SmartAPI', color: '#F87171' },
  { name: 'WebSocket Feed', color: '#4ADE80' },
] as const

const metrics = [
  { value: '7', label: 'indicators' },
  { value: '5', label: 'strategy templates' },
  { value: '13', label: 'phases complete' },
] as const

export function TechStack() {
  return (
    <section className="border-y border-border bg-panel py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 px-6">
        {stack.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">{item.name}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-3 px-6 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="border border-border bg-surface p-4">
            <div className="font-mono text-3xl text-accent">{metric.value}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">{metric.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
