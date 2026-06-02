'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { Activity, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
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
      className="flex items-center justify-between px-4 bg-bg/95 backdrop-blur-md border-b border-border/60 shrink-0"
      style={{ height: 'var(--top-header-h)' }}
    >
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-info to-blue-600 flex items-center justify-center text-bg font-bold text-sm shadow-cyan shrink-0">
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

      {/* Right status cluster */}
      <div className="flex items-center gap-2">
        {/* Market session */}
        <span className={cn('hidden min-[390px]:inline text-[10px] font-semibold font-mono', sessionColor)}>
          {sessionLabel}
        </span>

        {/* Connection indicator */}
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium',
          isConnected
            ? 'bg-up/10 text-up border border-up/20'
            : 'bg-text-faint/10 text-text-dim border border-border'
        )}>
          {isConnected
            ? <><LivePulseDot color="emerald" size="sm" className="mr-1 inline-block shrink-0" /><Wifi className="w-3 h-3" /> WS</>
            : <><WifiOff className="w-3 h-3" /> OFF</>
          }
        </div>

        {/* Safety lock */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-down/8 text-down border border-down/20 text-[10px] font-mono font-semibold">
          <ShieldCheck className="w-3 h-3" />
          LOCKED
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('system')}
          aria-label="Open System screen"
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60"
        >
          <Activity className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
