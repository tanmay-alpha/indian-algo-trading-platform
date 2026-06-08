import {
  IconActivityHeartbeat,
  IconApi,
  IconBrandCpp,
  IconBrandNextjs,
  IconPlugConnected,
  IconPuzzle,
} from '@tabler/icons-react'

const stack = [
  { name: 'Next.js 15', Icon: IconBrandNextjs },
  { name: 'FastAPI', Icon: IconApi },
  { name: 'C++17 Indicator Engine', Icon: IconBrandCpp },
  { name: 'pybind11', Icon: IconPuzzle },
  { name: 'Angel One SmartAPI', Icon: IconPlugConnected },
  { name: 'WebSocket Tick Feed', Icon: IconActivityHeartbeat },
] as const

export function TechStack() {
  return (
    <section className="border-y border-border bg-panel px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-3">
        {stack.map(({ name, Icon }) => (
          <div key={name} className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <Icon aria-hidden className="h-4 w-4" stroke={1.7} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
