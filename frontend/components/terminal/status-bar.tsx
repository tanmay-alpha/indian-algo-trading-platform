'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { WORKSPACES } from '@/lib/constants'
import { useNow } from '@/lib/use-now'

export function StatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const status = useTerminalStore((s) => s.terminalStatus)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const portfolioSummary = useTerminalStore((s) => s.portfolioSummary)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const now = useNow()

  const tickCount = status?.tick_bus?.total ?? status?.gateway?.tick_count ?? null
  const dropRate = status?.tick_bus?.drop_rate_pct ?? status?.gateway?.drop_rate_pct ?? null
  const tickAge = lastTickAt
    ? (now - lastTickAt) / 1000
    : status?.gateway?.last_tick_age_seconds ?? null
  const candleStatus = status?.candles ? 'READY' : '—'
  const brokerOnline = Boolean(broker?.logged_in)
  const workspace = WORKSPACES.find((item) => item.id === activeWorkspace)?.short ?? activeWorkspace
  const netPnl = portfolioSummary?.net_pnl ?? null

  return (
    <footer className="flex h-statusbar shrink-0 items-stretch border-t border-border bg-bg font-mono text-[10px]">
      <div
        className={cn(
          'flex shrink-0 items-center gap-1.5 border-r border-border px-3',
          wsConnected ? 'text-up' : 'text-text-faint'
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            wsConnected ? 'bg-up animate-pulse-soft' : 'bg-text-faint/40'
          )}
        />
        <span>{wsConnected ? 'WS CONNECTED' : wsStatus}</span>
      </div>

      <StatusCell label="API" value={apiStatus} valueClass={apiStatus === 'ONLINE' ? 'text-up' : 'text-text-dim'} />
      <StatusCell label="BRK" value={brokerOnline ? 'ONLINE' : '—'} valueClass={brokerOnline ? 'text-up' : 'text-text-dim'} />
      <StatusCell label="TICKS" value={tickCount ?? '—'} valueClass="text-text-2 tabular-nums" />
      <StatusCell
        label="DROP"
        value={dropRate != null ? `${dropRate.toFixed(2)}%` : '—'}
        valueClass={cn('tabular-nums', dropRate != null && dropRate > 1 ? 'text-warn' : 'text-text-2')}
      />
      <StatusCell
        label="AGE"
        value={tickAge != null ? `${tickAge.toFixed(0)}s` : '—'}
        valueClass={cn('tabular-nums', tickAge != null && tickAge > 30 ? 'text-warn' : 'text-text-2')}
      />
      <StatusCell label="CDL" value={candleStatus} valueClass="text-text-2" />

      <div className="flex-1" />

      <StatusCell label="WORKSPACE" value={workspace} valueClass="text-text-2" side="left" />
      <StatusCell label="SYM" value={selectedSymbol ?? '—'} valueClass="font-semibold text-text" side="left" />
      <StatusCell
        label="PNL"
        value={netPnl != null ? `₹${netPnl.toFixed(2)}` : '—'}
        valueClass={cn('tabular-nums', netPnl != null && netPnl > 0 ? 'text-up' : netPnl != null && netPnl < 0 ? 'text-down' : 'text-text-2')}
        side="left"
      />
      <div className="flex shrink-0 items-center border-l border-border px-2">
        <span className="rounded bg-paper/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-paper">
          PAPER
        </span>
      </div>
      <div className="flex shrink-0 items-center border-l border-border px-2 text-text-faint">
        v0.2
      </div>
    </footer>
  )
}

function StatusCell({
  label,
  value,
  valueClass,
  side = 'right',
}: {
  label: string
  value: string | number
  valueClass?: string
  side?: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 px-2',
        side === 'left' ? 'border-l border-border' : 'border-r border-border'
      )}
    >
      <span className="text-text-faint">{label}</span>
      <span className={cn('text-text-2', valueClass)}>{value}</span>
    </div>
  )
}
