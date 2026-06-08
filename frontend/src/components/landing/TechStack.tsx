const stack = [
  { name: 'Next.js 15', color: '#e0e3eb' },
  { name: 'FastAPI', color: '#26a69a' },
  { name: 'C++17 Engine', color: '#2962ff' },
  { name: 'pybind11', color: '#f59e0b' },
  { name: 'Angel One SmartAPI', color: '#ef5350' },
  { name: 'WebSocket Feed', color: '#26a69a' },
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
    </section>
  )
}
