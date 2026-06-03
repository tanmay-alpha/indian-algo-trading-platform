'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Command, Search } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { searchInstruments } from '@/lib/api'
import type { Instrument, WorkspaceId } from '@/lib/types'
import { WORKSPACES, PRESETS } from '@/lib/constants'
import { cn } from '@/lib/utils'

type CommandKind =
  | 'workspace'
  | 'preset'
  | 'symbol'
  | 'system'
  | 'placeholder'

interface PaletteCommand {
  id: string
  kind: CommandKind
  label: string
  hint?: string
  shortcut?: string
  payload?: { workspaceId?: WorkspaceId; presetId?: string; symbol?: string }
  disabled?: boolean
}

export function CommandPalette() {
  const open = useTerminalStore((s) => s.commandPaletteOpen)

  if (!open) return null

  return <CommandPaletteDialog />
}

function CommandPaletteDialog() {
  const close = () => useTerminalStore.getState().toggleCommandPalette(false)
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const setPreset = useTerminalStore((s) => s.setPreset)
  const setSelected = useTerminalStore((s) => s.setSelectedSymbol)
  const setBottomDockTab = useTerminalStore((s) => s.setBottomDockTab)
  const setRightPanelTab = useTerminalStore((s) => s.setRightPanelTab)
  const addToWatchlist = useTerminalStore((s) => s.addToWatchlist)
  const ingestEvent = useTerminalStore((s) => s.ingestEvent)

  const [query, setQuery] = useState('')
  const [symbols, setSymbols] = useState<Instrument[]>([])
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchInstruments(q)
        setSymbols(r.slice(0, 8))
      } catch {
        setSymbols([])
      } finally {
        setSearching(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  const baseCommands: PaletteCommand[] = useMemo(
    () => [
      ...WORKSPACES.map<PaletteCommand>((w) => ({
        id: `ws-${w.id}`,
        kind: 'workspace',
        label: `Open ${w.label}`,
        hint: 'Workspace',
        shortcut: w.shortcut,
        payload: { workspaceId: w.id },
      })),
      ...PRESETS.map<PaletteCommand>((p) => ({
        id: `pr-${p.id}`,
        kind: 'preset',
        label: `Apply preset - ${p.label}`,
        hint: p.description,
        payload: { presetId: p.id },
      })),
      {
        id: 'sys-events',
        kind: 'system',
        label: 'Show system events',
        hint: 'Bottom dock - Events',
      },
      {
        id: 'sys-health',
        kind: 'system',
        label: 'Show system health',
        hint: 'Bottom dock - System Health',
      },
      {
        id: 'sys-signals',
        kind: 'system',
        label: 'Show signal feed',
        hint: 'Right drawer - Signals',
      },
      {
        id: 'pl-buy',
        kind: 'placeholder',
        label: 'Paper Buy (placeholder)',
        hint: 'Live execution disabled in this build',
        disabled: true,
      },
      {
        id: 'pl-sell',
        kind: 'placeholder',
        label: 'Paper Sell (placeholder)',
        hint: 'Live execution disabled in this build',
        disabled: true,
      },
    ],
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return baseCommands
    return baseCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || (c.hint?.toLowerCase().includes(q) ?? false)
    )
  }, [query, baseCommands])

  const symbolCommands: PaletteCommand[] = useMemo(
    () =>
      symbols.flatMap((inst) => [
        {
          id: `sym-open-${inst.token}`,
          kind: 'symbol',
          label: `Open chart - ${inst.symbol}`,
          hint: `${inst.name} - ${inst.exchange}`,
          payload: { symbol: inst.symbol },
        } as PaletteCommand,
        {
          id: `sym-add-${inst.token}`,
          kind: 'symbol',
          label: `Add to watchlist - ${inst.symbol}`,
          hint: `${inst.name} - ${inst.exchange}`,
          payload: { symbol: inst.symbol },
        } as PaletteCommand,
      ]),
    [symbols]
  )

  const commands: PaletteCommand[] = useMemo(
    () => [...symbolCommands, ...filtered],
    [filtered, symbolCommands]
  )

  const safeActiveIndex = commands.length > 0
    ? Math.min(activeIndex, commands.length - 1)
    : 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(commands.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const c = commands[safeActiveIndex]
        if (c) execute(c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, safeActiveIndex])

  function execute(c: PaletteCommand) {
    if (c.disabled) {
      ingestEvent({
        event_type: 'placeholder',
        component: 'CMD',
        severity: 'warning',
        message: `${c.label} - placeholder, live execution disabled`,
      })
      return
    }
    switch (c.kind) {
      case 'workspace':
        if (c.payload?.workspaceId) setWorkspace(c.payload.workspaceId)
        break
      case 'preset':
        if (c.payload?.presetId)
          setPreset(c.payload.presetId as Parameters<typeof setPreset>[0])
        break
      case 'symbol': {
        const sym = c.payload?.symbol
        if (!sym) break
        if (c.id.startsWith('sym-open-')) {
          setSelected(sym)
          setWorkspace('trade')
        } else if (c.id.startsWith('sym-add-')) {
          addToWatchlist(sym)
        }
        break
      }
      case 'system':
        if (c.id === 'sys-events') setBottomDockTab('events')
        if (c.id === 'sys-health') setBottomDockTab('system-health')
        if (c.id === 'sys-signals') setRightPanelTab('signals')
        break
    }
    close()
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-[12vh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-w-[92vw] bg-panel-2 border border-border-strong rounded-sm shadow-modal overflow-hidden"
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-border">
          <Search className="w-4 h-4 text-text-dim shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const nextQuery = e.target.value
              setQuery(nextQuery)
              setActiveIndex(0)
              if (nextQuery.trim().length < 2) {
                setSymbols([])
                setSearching(false)
              }
            }}
            placeholder="Search symbols, workspaces, presets, commands..."
            className="flex-1 bg-transparent outline-none text-sm font-mono placeholder:text-text-dim"
          />
          <span className="text-xs font-mono text-text-faint">
            {searching ? 'searching...' : `${commands.length} results`}
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 h-[18px] rounded-sm border border-border text-xs font-mono text-text-dim">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {commands.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-text-dim">
              No matches
            </div>
          ) : (
            commands.map((c, idx) => {
              const active = idx === safeActiveIndex
              return (
                <button
                  key={c.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => execute(c)}
                  className={cn(
                    'w-full px-3 h-9 flex items-center gap-2 text-left transition-colors',
                    active ? 'bg-info/[0.08]' : 'hover:bg-white/[0.03]',
                    c.disabled && 'opacity-60'
                  )}
                >
                  <CmdKindBadge kind={c.kind} />
                  <span className="flex-1 min-w-0 text-xs font-mono truncate">
                    {c.label}
                  </span>
                  {c.hint && (
                    <span className="text-xs font-mono text-text-dim truncate max-w-[260px]">
                      {c.hint}
                    </span>
                  )}
                  {c.shortcut && (
                    <kbd className="px-1 h-[16px] rounded-sm border border-border text-xs font-mono text-text-dim">
                      {c.shortcut}
                    </kbd>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 h-7 flex items-center justify-between text-xs font-mono text-text-dim">
          <span className="flex items-center gap-1.5">
            <Command className="w-3 h-3" />
            <span>MAET.OS Command Layer</span>
          </span>
          <span className="flex items-center gap-3">
            <span>Up/Down navigate</span>
            <span>Enter run</span>
            <span>esc close</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function CmdKindBadge({ kind }: { kind: CommandKind }) {
  const cls: Record<CommandKind, string> = {
    workspace: 'text-info bg-info-dim border-info/20',
    preset: 'text-text-2 bg-white/[0.04] border-border',
    symbol: 'text-up bg-up-dim border-up/20',
    system: 'text-warn bg-warn-dim border-warn/20',
    placeholder: 'text-text-dim bg-white/[0.03] border-border',
  }
  const label: Record<CommandKind, string> = {
    workspace: 'WS',
    preset: 'PRE',
    symbol: 'SYM',
    system: 'SYS',
    placeholder: 'PL',
  }
  return (
    <span
      className={cn(
        'px-1.5 h-[16px] rounded-sm border text-xs font-mono uppercase tracking-wider inline-flex items-center',
        cls[kind]
      )}
    >
      {label[kind]}
    </span>
  )
}
