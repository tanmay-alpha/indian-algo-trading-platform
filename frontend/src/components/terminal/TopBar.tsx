'use client'

import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

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
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    setClock(formatIstTime())
    setOnline(navigator.onLine)

    const timer = window.setInterval(() => setClock(formatIstTime()), 1000)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const dotClass = online === true ? 'bg-up' : online === false ? 'bg-dn' : 'bg-warn'

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
