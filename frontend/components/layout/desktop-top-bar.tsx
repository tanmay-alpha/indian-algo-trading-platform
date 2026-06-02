'use client'

import { Activity, Radio, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
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
    <header className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#071018]/90 px-5 py-3 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-extrabold leading-tight text-text">{TITLES[activeTab]}</h1>
        <p className="text-xs font-medium text-text-dim">Safety-first NSE/BSE analytics and dry-run validation.</p>
      </div>

      <div className="flex max-w-[720px] flex-wrap items-center justify-end gap-2">
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
        <StatusChip label="LIVE LOCKED" tone="bad" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <StatusChip label="PAPER MODE" tone="warn" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <StatusChip label="READ ONLY" tone="muted" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <StatusChip label="AI ADVISORY ONLY" tone="warn" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
        <StatusChip label="BROKER MUTATION DISABLED" tone="bad" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
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
    good: 'border-up/25 bg-up/10 text-up',
    warn: 'border-warn/25 bg-warn/10 text-warn',
    bad: 'border-down/25 bg-down/10 text-down',
    muted: 'border-white/[0.08] bg-white/[0.04] text-text-dim',
  }[tone]

  return (
    <span className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold uppercase', toneClass)}>
      {icon}
      {label}
    </span>
  )
}
