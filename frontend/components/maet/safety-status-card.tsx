'use client'

import { ShieldCheck, WifiOff, Activity, Lock } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, getNseMarketSession } from '@/lib/utils'

export function SafetyStatusCard() {
  const wsStatus       = useTerminalStore((s) => s.wsStatus)
  const apiStatus      = useTerminalStore((s) => s.apiStatus)
  const backendOffline = useTerminalStore((s) => s.backendOffline)
  const marketSession  = getNseMarketSession()
  const mode           = useTerminalStore((s) => s.executionMode)

  const isOnline    = apiStatus === 'ONLINE' && !backendOffline
  const isConnected = wsStatus === 'CONNECTED'

  const sessionLabel = {
    OPEN:        'Market Open',
    LIVE:        'Market Open',
    PRE_MARKET:  'Pre-Market',
    POST_MARKET: 'Post-Market',
    CLOSED:      'Market Closed',
    WEEKEND:     'Weekend',
  }[marketSession ?? 'CLOSED'] ?? 'Closed'

  const sessionColor = (marketSession === 'OPEN' || marketSession === 'LIVE')
    ? 'text-up' : 'text-text-dim'

  return (
    <div className="rounded-2xl border border-down/20 bg-down/5 p-4 relative overflow-hidden">
      {/* Glow accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-down/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-down/10 border border-down/25 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-down" />
        </div>
        <div>
          <div className="text-sm font-semibold text-text">Safety Status</div>
          <div className="text-xs text-text-faint">Live trading permanently locked</div>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] font-mono font-bold bg-down/10 text-down border border-down/25 px-2 py-0.5 rounded-full">
            LIVE LOCKED
          </span>
        </div>
      </div>

      {/* Status rows */}
      <div className="space-y-2">
        <StatusRow
          icon={<Lock className="w-3.5 h-3.5 text-down" />}
          label="Live Execution"
          value="LOCKED"
          valueClass="text-down font-semibold"
        />
        <StatusRow
          icon={<ShieldCheck className="w-3.5 h-3.5 text-info" />}
          label="Trading Mode"
          value={mode ?? 'PAPER'}
          valueClass="text-info font-semibold"
        />
        <StatusRow
          icon={<Activity className="w-3.5 h-3.5 text-text-faint" />}
          label="Backend API"
          value={isOnline ? 'ONLINE' : backendOffline ? 'OFFLINE' : 'WAKING'}
          valueClass={isOnline ? 'text-up' : 'text-warn'}
        />
        <StatusRow
          icon={<Activity className="w-3.5 h-3.5 text-text-faint" />}
          label="WebSocket"
          value={isConnected ? 'CONNECTED' : wsStatus ?? 'OFFLINE'}
          valueClass={isConnected ? 'text-up' : 'text-warn'}
        />
        <StatusRow
          icon={<Activity className="w-3.5 h-3.5 text-text-faint" />}
          label="Market Session"
          value={sessionLabel.toUpperCase()}
          valueClass={sessionColor}
        />
      </div>

      {/* Safety badges */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-1.5">
        <SafetyPill color="down">LIVE LOCKED</SafetyPill>
        <SafetyPill color="info">PAPER MODE</SafetyPill>
        <SafetyPill color="info">READ ONLY</SafetyPill>
        <SafetyPill color="warn">AI ADVISORY ONLY</SafetyPill>
        <SafetyPill color="violet">BROKER MUTATION DISABLED</SafetyPill>
      </div>
    </div>
  )
}

function StatusRow({ icon, label, value, valueClass }: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs text-text-dim">
        {icon}
        {label}
      </div>
      <span className={cn('text-xs font-mono font-medium', valueClass)}>
        {value}
      </span>
    </div>
  )
}

function SafetyPill({ children, color }: { children: React.ReactNode; color: 'down' | 'info' | 'warn' | 'violet' }) {
  const cls = {
    down:   'bg-down/10 border-down/25 text-down',
    info:   'bg-info/10 border-info/25 text-info',
    warn:   'bg-warn/10 border-warn/25 text-warn',
    violet: 'bg-violet/10 border-violet/25 text-violet',
  }[color]

  return (
    <span className={cn('text-[9px] font-mono font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border', cls)}>
      {children}
    </span>
  )
}
