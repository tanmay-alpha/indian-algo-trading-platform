'use client'

import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useTerminalStore } from '@/store/terminal-store'

function formatIstTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

export function TopBar() {
  const [clock, setClock] = useState('--:--:--')
  const wsStatus = useTerminalStore((state) => state.wsStatus)
  const demoMode = useTerminalStore((state) => state.wsDemoMode)

  useEffect(() => {
    setClock(formatIstTime())

    const timer = window.setInterval(() => setClock(formatIstTime()), 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const status = normalizeStatus(wsStatus)
  const dotClass = status === 'connected'
    ? 'animate-pulse bg-up'
    : status === 'offline'
    ? 'bg-dn'
    : 'animate-pulse bg-warn'
  const statusLabel = status === 'connected' ? 'NSE live' : demoMode ? 'Market replay' : 'NSE warming'

  return (
    <header className="group flex h-[44px] shrink-0 items-center justify-between border-b border-accent/20 bg-panel px-4 transition-colors hover:border-accent/35">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-sm font-medium tracking-normal text-accent">MAET</span>
        </div>
        <Badge variant="paper">paper mode</Badge>
        {demoMode && <Badge variant="warn">Demo mode</Badge>}
      </div>

      <div className="flex items-center gap-3 font-mono text-[10px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          <span>{statusLabel}</span>
        </span>
        <span>{clock} IST</span>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-sm border border-border text-text-muted transition-colors hover:border-border-light hover:bg-hover hover:text-text-primary"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

function normalizeStatus(status: string): 'connected' | 'connecting' | 'degraded' | 'offline' {
  if (status === 'CONNECTED' || status === 'connected') return 'connected'
  if (status === 'CONNECTING' || status === 'connecting') return 'connecting'
  if (status === 'OFFLINE' || status === 'offline') return 'offline'
  return 'degraded'
}
