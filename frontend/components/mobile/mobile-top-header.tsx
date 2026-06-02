'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { Activity, Wifi, WifiOff } from 'lucide-react'
import { cn, getNseMarketSession } from '@/lib/utils'
import { LivePulseDot } from '@/components/effects/live-pulse-dot'
import type { AppTab } from './mobile-bottom-nav'

interface MobileTopHeaderProps {
  title?: string
  onNavigate?: (tab: AppTab) => void
}

export function MobileTopHeader({ title, onNavigate }: MobileTopHeaderProps) {
  const wsStatus    = useTerminalStore((s) => s.wsStatus)
  const marketSession = getNseMarketSession()

  const isConnected = wsStatus === 'CONNECTED'

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
      className="mx-3 mt-3 flex items-center justify-between rounded-2xl border border-maet-glass-border bg-maet-bg-deep/62 px-3 shadow-card backdrop-blur-2xl shrink-0"
      style={{ height: 'var(--top-header-h)' }}
    >
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-2xl border border-maet-glass-border bg-gradient-to-br from-maet-cyan to-maet-blue-strong flex items-center justify-center text-bg font-bold text-sm shadow-cyan shrink-0">
          M
        </div>
        <div>
          <div className="text-sm font-bold text-text tracking-wide leading-tight">
            {title ?? 'MAET'}
          </div>
          <div className="text-[10px] text-text-faint leading-tight font-mono">
            Research Terminal
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn('hidden min-[390px]:inline text-[10px] font-semibold font-mono', sessionColor)}>
          {sessionLabel}
        </span>

        <div className={cn(
          'flex min-h-7 items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium shadow-inner',
          isConnected
            ? 'bg-up/10 text-up border border-up/20'
            : 'bg-text-faint/10 text-text-dim border border-border'
        )}>
          {isConnected
            ? <><LivePulseDot color="emerald" size="sm" className="mr-1 inline-block shrink-0" /><Wifi className="w-3 h-3" /> WS</>
            : <><WifiOff className="w-3 h-3" /> OFF</>
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
