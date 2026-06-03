'use client'

import { useState, useRef, useEffect } from 'react'
import { Layout, ChevronDown } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { PRESETS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function WorkspacePresetSelector() {
  const activePreset = useTerminalStore((s) => s.activePreset)
  const setPreset = useTerminalStore((s) => s.setPreset)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const active = PRESETS.find((p) => p.id === activePreset)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 h-[22px] rounded-sm border text-xs font-mono uppercase tracking-wider',
          active
            ? 'text-info border-info/30 bg-info-dim'
            : 'text-text-2 border-border bg-panel/60 hover:border-border-strong'
        )}
        title="Workspace preset"
      >
        <Layout className="w-3 h-3" />
        <span>{active ? active.label : 'PRESET'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[280px] bg-panel-2 border border-border-strong rounded-sm shadow-modal py-1">
          <div className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-text-faint border-b border-border">
            Workspace Presets
          </div>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPreset(p.id)
                setOpen(false)
              }}
              className={cn(
                'w-full px-3 py-1.5 flex flex-col items-start text-left hover:bg-white/[0.04]',
                activePreset === p.id && 'bg-info/[0.06]'
              )}
            >
              <span className="text-xs font-mono text-text">{p.label}</span>
              <span className="text-xs text-text-dim font-mono leading-tight">
                {p.description}
              </span>
            </button>
          ))}
          {activePreset && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  setPreset(null)
                  setOpen(false)
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-mono text-text-dim hover:text-text hover:bg-white/[0.04]"
              >
                Clear preset
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
