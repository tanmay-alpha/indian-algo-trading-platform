'use client'

import { Keyboard, X } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'

interface ShortcutGroup {
  title: string
  items: { keys: string[]; label: string }[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Open command palette' },
      { keys: ['/'], label: 'Focus symbol search' },
      { keys: ['?'], label: 'Toggle this overlay' },
      { keys: ['Esc'], label: 'Close overlays' },
    ],
  },
  {
    title: 'Workspaces',
    items: [
      { keys: ['1'], label: 'Trade' },
      { keys: ['2'], label: 'Markets' },
      { keys: ['3'], label: 'Charts' },
      { keys: ['4'], label: 'Portfolio' },
      { keys: ['5'], label: 'Strategy Lab' },
      { keys: ['6'], label: 'Risk / System' },
      { keys: ['7'], label: 'Journal' },
    ],
  },
  {
    title: 'Order ticket',
    items: [
      { keys: ['B'], label: 'Paper Buy preview (execution off)' },
      { keys: ['S'], label: 'Paper Sell preview (execution off)' },
    ],
  },
]

export function KeyboardShortcutsOverlay() {
  const open = useTerminalStore((s) => s.shortcutsOpen)
  const close = () => useTerminalStore.getState().toggleShortcuts(false)

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[600px] max-w-[92vw] overflow-hidden rounded-sm border border-border-strong bg-panel-2 shadow-modal"
      >
        <div className="flex h-10 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2 text-text">
            <Keyboard className="h-4 w-4 text-info" />
            <span className="font-mono text-xs uppercase tracking-wider">
              Keyboard shortcuts
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-text-dim hover:text-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="rounded-sm border border-border">
              <div className="flex h-7 items-center border-b border-border px-3 font-mono text-xs uppercase tracking-wider text-text-faint">
                {g.title}
              </div>
              <ul className="divide-y divide-border/60">
                {g.items.map((it) => (
                  <li
                    key={it.label}
                    className="flex h-8 items-center justify-between px-3 font-mono text-xs"
                  >
                    <span className="text-text-2">{it.label}</span>
                    <span className="flex items-center gap-1">
                      {it.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] text-text"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
