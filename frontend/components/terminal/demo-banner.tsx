'use client'

import { X } from 'lucide-react'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'maet_disclaimer_dismissed'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getDismissedSnapshot() {
  if (typeof window === 'undefined') return true
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

function notifyDismissedChanged() {
  listeners.forEach((listener) => listener())
}

export function DemoBanner() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getDismissedSnapshot,
    () => true
  )

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
          notifyDismissedChanged()
        }}
        className="ml-auto rounded-sm p-1 text-text-dim hover:text-text hover:bg-white/[0.06]"
        aria-label="Dismiss demo banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
