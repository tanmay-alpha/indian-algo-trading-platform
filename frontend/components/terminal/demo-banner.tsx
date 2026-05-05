'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'maet_disclaimer_dismissed'

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  if (dismissed) return null

  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-b border-warn/30 bg-warn-dim px-3 text-[11px] font-mono text-warn">
      <span className="font-semibold">MAET Terminal — Research & Paper Demo.</span>
      <span className="text-text-2">
        PAPER mode only. No real orders.
      </span>
      <a
        href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
        target="_blank"
        rel="noreferrer"
        className="text-info hover:text-text"
      >
        View on GitHub →
      </a>
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
