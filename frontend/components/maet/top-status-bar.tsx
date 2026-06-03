'use client'

import { useEffect, useState } from 'react'
import { Activity, Clock } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { useIstClock } from '@/lib/use-ist-clock'
import { getNseMarketSession } from '@/lib/utils'
import { SafetyBadgeGroup } from './safety-badge'

export function TopStatusBar() {
  const [mounted, setMounted] = useState(false)
  const connectionState = useTerminalStore((s) => s.wsStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const istTime = useIstClock()

  useEffect(() => {
    setMounted(true)
  }, [])

  const session = mounted ? getNseMarketSession() : 'CLOSED'

  // Determine connection badge details
  const getConnDetails = () => {
    if (backendWakeState === 'WAKING') {
      return { label: 'WAKING', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    }
    switch (connectionState) {
      case 'CONNECTED':
        return { label: 'CONNECTED', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
      case 'CONNECTING':
        return { label: 'CONNECTING', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' }
      case 'RECONNECTING':
        return { label: 'RECONNECTING', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' }
      default:
        return { label: 'OFFLINE', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' }
    }
  }

  const conn = getConnDetails()

  // Market session display values
  const getSessionLabel = () => {
    switch (session) {
      case 'OPEN':
      case 'LIVE':
        return 'NSE/BSE OPEN'
      case 'PRE_MARKET':
        return 'PRE-MARKET'
      case 'POST_MARKET':
        return 'POST-MARKET'
      case 'WEEKEND':
        return 'WEEKEND CLOSED'
      default:
        return 'MARKET CLOSED'
    }
  }

  const sessionLabel = getSessionLabel()
  const isMarketOpen = session === 'OPEN' || session === 'LIVE'

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0f17]/80 backdrop-blur-md px-4 select-none z-30">
      {/* Top Banner Alert for cold starts */}
      {(backendWakeState === 'WAKING' || apiStatus === 'OFFLINE') && (
        <div className="absolute left-1/2 top-[58px] -translate-x-1/2 z-40 rounded-lg border border-amber-500/20 bg-[#0f131a]/95 px-4 py-2 text-xs font-mono text-amber-400 shadow-xl backdrop-blur-md flex items-center gap-2 max-w-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>
            {backendWakeState === 'WAKING'
              ? 'Cold starting backend... This can take 30s.'
              : 'Connection lost - attempting reconnect.'}
          </span>
        </div>
      )}

      {/* Brand & Market Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-mono font-bold text-white shadow-lg shadow-cyan-500/20 text-sm">
            M
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white leading-none">MAET Terminal</h1>
            <span className="text-xs text-text-dim font-mono">Market Analytics & Execution</span>
          </div>
        </div>

        <div className="hidden sm:block h-4 w-px bg-white/[0.08]" />

        {/* Live Ticker Status */}
        <div className={`hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono ${
          isMarketOpen ? 'bg-up/10 border-up/20 text-up' : 'bg-white/[0.02] border-white/[0.06] text-text-dim'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-up animate-pulse' : 'bg-text-faint'}`} />
          {sessionLabel}
        </div>
      </div>

      {/* System Status Indicators / Clock */}
      <div className="flex items-center gap-3">
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-text-dim bg-white/[0.02] border border-white/[0.06] px-2.5 py-1 rounded-md">
          <Clock className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>{istTime || '--:--:--'} IST</span>
        </div>

        {/* Connection status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-semibold ${conn.color}`}>
          <Activity className="w-3.5 h-3.5" />
          <span>{conn.label}</span>
        </div>

        {/* Permanent Security / Gated Status Group */}
        <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.06] px-2 py-1 rounded-lg">
          <SafetyBadgeGroup />
        </div>
      </div>
    </header>
  )
}
