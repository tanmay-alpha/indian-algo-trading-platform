'use client'

import { Activity, Radio, Wifi, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { LivePulseDot } from '@/components/effects/live-pulse-dot'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, getNseMarketSession } from '@/lib/utils'

const TITLES: Record<AppTab, string> = {
  home: 'Market command center',
  watchlist: 'Watchlist and symbol discovery',
  chart: 'Chart workspace',
  portfolio: 'Read-only portfolio snapshot',
  ai: 'AI advisory desk',
  system: 'System readiness',
}

export function DesktopTopBar({ activeTab }: { activeTab: AppTab }) {
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const session = getNseMarketSession()
  const wsOnline = wsStatus === 'CONNECTED'
  const apiOnline = apiStatus === 'ONLINE'

  const sessionLabel = {
    OPEN: 'MARKET OPEN',
    LIVE: 'MARKET OPEN',
    PRE_MARKET: 'PRE-MARKET',
    POST_MARKET: 'POST-MARKET',
    CLOSED: 'MARKET CLOSED',
    WEEKEND: 'WEEKEND',
  }[session ?? 'CLOSED'] ?? 'MARKET CLOSED'

  return (
    <header className="m-3 mb-0 flex min-h-16 shrink-0 items-center justify-between gap-4 rounded-2xl border border-maet-glass-border bg-maet-bg-deep/58 px-5 py-3 shadow-card backdrop-blur-2xl">
      <div>
        <h1 className="font-heading text-xl font-bold leading-tight text-maet-text xl-heading">{TITLES[activeTab]}</h1>
        <p className="text-xs font-medium text-maet-text-muted">Market session, backend state, and read-only research context.</p>
      </div>

      <div className="flex max-w-[640px] flex-wrap items-center justify-end gap-2">
        <StatusChip label={sessionLabel} tone={session === 'OPEN' ? 'good' : 'warn'} icon={<Activity className="h-3.5 w-3.5" />} />
        <StatusChip
          label={apiOnline ? 'API ONLINE' : 'API OFFLINE'}
          tone={apiOnline ? 'good' : 'bad'}
          icon={apiOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        />
        <StatusChip
          label={wsOnline ? 'WS CONNECTED' : 'WS OFF'}
          tone={wsOnline ? 'good' : 'muted'}
          icon={wsOnline ? <LivePulseDot color="emerald" size="sm" /> : <Radio className="h-3.5 w-3.5" />}
        />
        <StatusChip label="v0.1.0" tone="muted" icon={<span className="h-1.5 w-1.5 rounded-full bg-current" />} />
      </div>
    </header>
  )
}

function StatusChip({
  label,
  tone,
  icon,
}: {
  label: string
  tone: 'good' | 'warn' | 'bad' | 'muted'
  icon: ReactNode
}) {
  const toneClass = {
    good: 'border-maet-green/25 bg-maet-green/10 text-maet-green',
    warn: 'border-maet-amber/25 bg-maet-amber/10 text-maet-amber',
    bad: 'border-maet-red/25 bg-maet-red/10 text-maet-red',
    muted: 'border-maet-border bg-maet-elevated text-maet-text-secondary',
  }[tone]

  return (
    <span className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] font-bold uppercase shadow-inner', toneClass)}>
      {icon}
      {label}
    </span>
  )
}
