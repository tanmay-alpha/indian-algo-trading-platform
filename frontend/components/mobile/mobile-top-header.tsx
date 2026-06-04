'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { Activity, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useMarketSession } from '@/lib/use-market-session'
import { LivePulseDot } from '@/components/effects/live-pulse-dot'
import type { AppTab } from './mobile-bottom-nav'

interface MobileTopHeaderProps {
  title?: string
  onNavigate?: (tab: AppTab) => void
}

export function MobileTopHeader({ title, onNavigate }: MobileTopHeaderProps) {
  const wsStatus    = useTerminalStore((s) => s.wsStatus)
  const apiStatus   = useTerminalStore((s) => s.apiStatus)
  const marketSession = useMarketSession()
  const [coldStartVisible, setColdStartVisible] = useState(false)
  const [coldStartDismissed, setColdStartDismissed] = useState(false)

  const isConnected = wsStatus === 'CONNECTED'
  const apiConnecting = apiStatus !== 'ONLINE'

  useEffect(() => {
    if (!apiConnecting) {
      setColdStartVisible(false)
      setColdStartDismissed(false)
      return undefined
    }

    const timer = window.setTimeout(() => setColdStartVisible(true), 30_000)
    return () => window.clearTimeout(timer)
  }, [apiConnecting])

  const sessionColor = {
    OPEN:        'text-up',
    LIVE:        'text-up',
    PRE_MARKET:  'text-warn',
    POST_MARKET: 'text-warn',
    CLOSED:      'text-text-dim',
    WEEKEND:     'text-text-dim',
  }[marketSession ?? 'CLOSED'] ?? 'text-text-dim'

  const sessionLabel = {
    OPEN:        'MARKET OPEN',
    LIVE:        'MARKET OPEN',
    PRE_MARKET:  'PRE-MARKET',
    POST_MARKET: 'POST-MARKET',
    CLOSED:      'MARKET CLOSED',
    WEEKEND:     'WEEKEND',
  }[marketSession ?? 'CLOSED'] ?? 'CLOSED'

  return (
    <header
      className="relative mx-3 mt-3 flex items-center justify-between rounded-2xl border border-maet-glass-border bg-maet-bg-deep/60 px-3 shadow-card backdrop-blur-2xl shrink-0"
      style={{ height: 'var(--top-header-h)' }}
    >
      {apiConnecting && coldStartVisible && !coldStartDismissed && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 mx-auto flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-sm border border-maet-amber/25 bg-maet-amber/10 px-3 py-1.5 text-xs font-mono font-semibold text-maet-amber">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-maet-amber pulse-soft" />
          <span className="min-w-0 flex-1">Backend cold starting — Render Free (~30s). Refresh if needed.</span>
          <button
            type="button"
            onClick={() => setColdStartDismissed(true)}
            aria-label="Dismiss cold-start notice"
            className="shrink-0 rounded-sm border border-maet-amber/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-maet-amber"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-2xl border border-maet-glass-border bg-maet-cyan flex items-center justify-center text-bg font-bold text-sm shrink-0">
          M
        </div>
        <div>
          <div className="text-base font-bold text-text leading-tight">
            {title ?? 'MAET'}
          </div>
          <div className="text-xs text-text-faint leading-tight font-semibold">
            Research Terminal
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn('hidden min-[390px]:inline text-xs font-extrabold', sessionColor)}>
          {sessionLabel}
        </span>

        <div className={cn(
          'flex min-h-8 items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-inner',
          isConnected
            ? 'bg-up/10 text-up border border-up/20'
            : 'bg-warn/10 text-warn border border-warn/20'
        )}>
          {isConnected
            ? <><LivePulseDot color="emerald" size="sm" className="mr-1 inline-block shrink-0" /><Wifi className="w-3 h-3" /> WS</>
            : <><WifiOff className="w-3 h-3" /> Connecting...</>
          }
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('system')}
          aria-label="Open System screen"
          className="grid h-10 w-10 place-items-center rounded-2xl border border-maet-glass-border bg-maet-glass-1 text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60"
        >
          <Activity className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
