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
    title: 'Order ticket (placeholders)',
    items: [
      { keys: ['B'], label: 'Paper Buy (disabled — execution off)' },
      { keys: ['S'], label: 'Paper Sell (disabled — execution off)' },
    ],
  },
]

export function KeyboardShortcutsOverlay() {
  const open = useTerminalStore((s) => s.shortcutsOpen)
  const close = () => useTerminalStore.getState().toggleShortcuts(false)

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-[2px] flex items-center justify-center"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[600px] max-w-[92vw] bg-panel-2 border border-border-strong rounded-sm shadow-modal overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 h-10 border-b border-border">
          <div className="flex items-center gap-2 text-text">
            <Keyboard className="w-4 h-4 text-info" />
            <span className="text-xs font-mono uppercase tracking-wider">
              Keyboard shortcuts
            </span>
          </div>
          <button
            onClick={close}
            className="text-text-dim hover:text-text"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="border border-border rounded-sm">
              <div className="px-3 h-7 flex items-center border-b border-border text-xs font-mono uppercase tracking-wider text-text-faint">
                {g.title}
              </div>
              <ul className="divide-y divide-border/60">
                {g.items.map((it) => (
                  <li
                    key={it.label}
                    className="flex items-center justify-between px-3 h-8 text-xs font-mono"
                  >
                    <span className="text-text-2">{it.label}</span>
                    <span className="flex items-center gap-1">
                      {it.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-1.5 h-[18px] inline-flex items-center rounded-sm border border-border bg-panel text-xs text-text"
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
        <div className="border-t border-border h-7 px-3 flex items-center justify-between text-xs font-mono text-text-dim">
          <span>MAET.OS keyboard layer</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
