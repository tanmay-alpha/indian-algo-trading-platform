interface StatusBarProps {
  ticks: number
  dayPnl: number
  version?: string
}

function formatMoney(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export function StatusBar({ ticks, dayPnl, version = 'v0.2' }: StatusBarProps) {
  const positive = dayPnl >= 0

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-panel px-4 font-mono text-[10px] text-muted">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-up" />
          <span>WS demo</span>
        </span>
        <span className="h-3 w-px bg-border-strong" />
        <span>Feed: {ticks.toLocaleString('en-IN')} ticks</span>
        <span className="h-3 w-px bg-border-strong" />
        <span>Broker: paper</span>
        <span className="h-3 w-px bg-border-strong" />
        <span>Engine: ready</span>
      </div>

      <div className="flex items-center gap-3">
        <span className={positive ? 'text-up' : 'text-dn'}>
          Day P&amp;L: {positive ? '+' : ''}{formatMoney(dayPnl)}
        </span>
        <span className="h-3 w-px bg-border-strong" />
        <span>{version}</span>
      </div>
    </footer>
  )
}
