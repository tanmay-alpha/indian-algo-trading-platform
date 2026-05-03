'use client'

import { useEffect } from 'react'
import { WorkspaceRail } from './workspace-rail'
import { TopMarketBar } from './top-market-bar'
import { WatchlistPanel } from './watchlist-panel'
import { RightTradePanel } from './right-trade-panel'
import { StatusBar } from './status-bar'
import { CommandPalette } from './command-palette'
import { KeyboardShortcutsOverlay } from './keyboard-shortcuts-overlay'
import { WorkspaceContent } from '@/components/workspaces/workspace-content'
import { BottomDock } from '@/components/tabs/bottom-dock'
import { useTerminalStore } from '@/store/terminal-store'
import type { WorkspaceId } from '@/lib/types'

const WORKSPACE_KEYS: Record<string, WorkspaceId> = {
  '1': 'trade',
  '2': 'markets',
  '3': 'charts',
  '4': 'portfolio',
  '5': 'strategy',
  '6': 'risk',
  '7': 'journal',
}

export function TerminalLayout() {
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const toggleCommandPalette = useTerminalStore((s) => s.toggleCommandPalette)
  const toggleShortcuts = useTerminalStore((s) => s.toggleShortcuts)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggleCommandPalette(true)
        return
      }
      if (!typing && event.key === '?') {
        event.preventDefault()
        toggleShortcuts(true)
        return
      }
      if (!typing && WORKSPACE_KEYS[event.key]) {
        event.preventDefault()
        setWorkspace(WORKSPACE_KEYS[event.key])
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setWorkspace, toggleCommandPalette, toggleShortcuts])

  return (
    <div className="h-screen min-w-[1100px] flex flex-col bg-bg text-text overflow-hidden">
      <div className="flex flex-1 min-h-0">
        <WorkspaceRail />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopMarketBar />
          <div className="flex-1 min-h-0 flex">
            <WatchlistPanel />
            <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-bg term-grid">
              <WorkspaceContent />
              <BottomDock />
            </main>
            <RightTradePanel />
          </div>
          <StatusBar />
        </div>
      </div>
      <CommandPalette />
      <KeyboardShortcutsOverlay />
    </div>
  )
}
