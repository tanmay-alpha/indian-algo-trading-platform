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

  useEffect(() => {
    setClock(formatIstTime())

    const timer = window.setInterval(() => setClock(formatIstTime()), 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const status = normalizeStatus(wsStatus)
  const dotClass = status === 'connected' ? 'bg-up' : status === 'offline' ? 'bg-dn' : 'bg-warn'

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
      <div className="flex items-center gap-3">
        <div className="font-mono text-sm font-medium tracking-normal text-primary">MAET</div>
        <Badge variant="paper">Paper mode</Badge>
      </div>

      <div className="flex items-center gap-3 font-mono text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span>NSE live</span>
        </span>
        <span>{clock} IST</span>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-sm border border-border text-muted transition-colors hover:border-strong hover:bg-hover hover:text-primary"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

function normalizeStatus(status: string) {
  if (status === 'CONNECTED' || status === 'connected') return 'connected'
  if (status === 'OFFLINE' || status === 'offline') return 'offline'
  return 'degraded'
}
