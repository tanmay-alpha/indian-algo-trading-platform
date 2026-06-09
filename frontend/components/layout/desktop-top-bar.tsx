'use client'

import { Activity, Clock, Radio, Wifi } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { LivePulseDot } from '@/components/effects/live-pulse-dot'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { useMarketSession } from '@/lib/use-market-session'
import { useIstClock } from '@/lib/use-ist-clock'

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
  const session = useMarketSession()
  const istTime = useIstClock()
  const wsOnline = wsStatus === 'CONNECTED'
  const apiOnline = apiStatus === 'ONLINE'
  const apiConnecting = !apiOnline
  const previousApiStatus = useRef(apiStatus)
  const [coldStartVisible, setColdStartVisible] = useState(false)
  const [coldStartDismissed, setColdStartDismissed] = useState(false)
  const [apiFlash, setApiFlash] = useState(false)

  useEffect(() => {
    if (!apiConnecting) {
      setColdStartVisible(false)
      setColdStartDismissed(false)
      return undefined
    }

    const timer = window.setTimeout(() => setColdStartVisible(true), 30_000)
    return () => window.clearTimeout(timer)
  }, [apiConnecting])

  useEffect(() => {
    if (apiOnline && previousApiStatus.current !== 'ONLINE') {
      setApiFlash(true)
      const timer = window.setTimeout(() => setApiFlash(false), 600)
      previousApiStatus.current = apiStatus
      return () => window.clearTimeout(timer)
    }
    previousApiStatus.current = apiStatus
    return undefined
  }, [apiOnline, apiStatus])

  const sessionLabel = {
    OPEN: 'MARKET OPEN',
    LIVE: 'MARKET OPEN',
    PRE_MARKET: 'PRE-MARKET',
    POST_MARKET: 'POST-MARKET',
    CLOSED: 'MARKET CLOSED',
    WEEKEND: 'WEEKEND',
  }[session ?? 'CLOSED'] ?? 'MARKET CLOSED'
  const clockLabel = istTime === '--:--:--' ? istTime : `${istTime} IST`

  return (
    <header className="relative m-3 mb-0 flex min-h-16 shrink-0 items-center justify-between gap-4 rounded-2xl border border-maet-glass-border bg-maet-bg-deep/60 px-5 py-3 shadow-card backdrop-blur-2xl">
      {apiConnecting && coldStartVisible && !coldStartDismissed && (
        <div className="absolute left-1/2 top-[calc(100%+6px)] z-40 flex -translate-x-1/2 items-center gap-2 rounded-sm border border-maet-amber/25 bg-maet-amber/10 px-3 py-1.5 text-xs font-mono font-semibold text-maet-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-maet-amber pulse-soft" />
          <span>Backend cold starting — Render Free (~30s). Refresh if needed.</span>
          <button
            type="button"
            onClick={() => setColdStartDismissed(true)}
            aria-label="Dismiss cold-start notice"
            className="rounded-sm border border-maet-amber/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-maet-amber"
          >
            Dismiss
          </button>
        </div>
      )}
      <div>
        <h1 className="font-heading text-xl font-bold leading-tight text-maet-text xl-heading">{TITLES[activeTab]}</h1>
        <p className="text-xs font-medium text-maet-text-muted">Market session, connection state, and read-only research context.</p>
      </div>

      <div className="flex max-w-[640px] flex-wrap items-center justify-end gap-2">
        <StatusChip label="PAPER MODE" tone="warn" icon={<Activity className="h-3.5 w-3.5" />} />
        <StatusChip label={sessionLabel} tone={session === 'OPEN' ? 'good' : 'warn'} icon={<Activity className="h-3.5 w-3.5" />} />
        <StatusChip label={clockLabel} tone="muted" icon={<Clock className="h-3.5 w-3.5" />} />
        <StatusChip
          label={apiOnline ? 'DATA READY' : 'Connecting...'}
          tone={apiOnline ? 'good' : 'warn'}
          icon={apiOnline ? <Wifi className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
          className={apiFlash ? 'flash-up' : undefined}
        />
        <StatusChip
          label={wsOnline ? 'STREAM CONNECTED' : 'Connecting...'}
          tone={wsOnline ? 'good' : 'warn'}
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
  className,
}: {
  label: string
  tone: 'good' | 'warn' | 'bad' | 'muted'
  icon: ReactNode
  className?: string
}) {
  const toneClass = {
    good: 'border-maet-green/25 bg-maet-green/10 text-maet-green',
    warn: 'border-maet-amber/25 bg-maet-amber/10 text-maet-amber',
    bad: 'border-maet-red/25 bg-maet-red/10 text-maet-red',
    muted: 'border-maet-border bg-maet-elevated text-maet-text-secondary',
  }[tone]

  return (
    <span className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-xs font-bold uppercase shadow-inner', toneClass, className)}>
      {icon}
      {label}
    </span>
  )
}
