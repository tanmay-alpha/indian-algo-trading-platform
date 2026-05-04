'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTerminalStore } from '@/store/terminal-store'

const STORAGE_KEY = 'maet-demo-banner-dismissed'

export function DemoBanner() {
  const status = useTerminalStore((s) => s.terminalStatus)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  if (!status?.demo_mode || dismissed) return null

  return (
    <div className="h-8 shrink-0 border-b border-warn/30 bg-warn-dim px-3 flex items-center gap-3 text-[11px] font-mono text-warn">
      <span className="font-semibold">DEMO PREVIEW</span>
      <span className="text-text-2">
        {status.demo_banner || 'No live orders, no real capital'}
      </span>
      <span className="text-text-faint">No live orders, no real capital</span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, '1')
          setDismissed(true)
        }}
        className="ml-auto rounded-sm p-1 text-text-dim hover:text-text hover:bg-white/[0.06]"
        aria-label="Dismiss demo banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
