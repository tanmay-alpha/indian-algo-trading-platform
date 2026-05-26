'use client'

import { useEffect } from 'react'
import { WorkspaceRail } from './workspace-rail'
import { TopMarketBar } from './top-market-bar'
import { WatchlistPanel } from './watchlist-panel'
import { RightTradePanel } from './right-trade-panel'
import { StatusBar } from './status-bar'
import { DemoBanner } from './demo-banner'
import { CommandPalette } from './command-palette'
import { KeyboardShortcutsOverlay } from './keyboard-shortcuts-overlay'
import { WorkspaceContent } from '@/components/workspaces/workspace-content'
import { BottomDock } from '@/components/tabs/bottom-dock'
import { useTerminalStore } from '@/store/terminal-store'
import type { WorkspaceId } from '@/lib/types'

const WORKSPACE_KEYS: Record<string, WorkspaceId> = {
  '1': 'trade',
  '2': 'markets',
  '3': 'strategy',
  '4': 'portfolio',
  '5': 'oms',
  '6': 'journal',
}

export function TerminalLayout() {
  const setWorkspace = useTerminalStore((s) => s.setWorkspace)
  const toggleCommandPalette = useTerminalStore((s) => s.toggleCommandPalette)
  const toggleShortcuts = useTerminalStore((s) => s.toggleShortcuts)
  const bottomDockOpen = useTerminalStore((s) => s.bottomDockOpen)

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
      if (!typing && event.shiftKey && event.key.toUpperCase() === 'D') {
        event.preventDefault()
        const { bottomDockOpen, setBottomDockOpen } = useTerminalStore.getState()
        setBottomDockOpen(!bottomDockOpen)
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

  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const layoutMode = useTerminalStore((s) => s.chartLayoutMode)
  const isFocusMode = layoutMode === 'FOCUS'
  const showSidePanels = activeWorkspace === 'trade' && !isFocusMode

  return (
    <div className="h-screen flex flex-col bg-bg text-text overflow-hidden select-none">
      <div className="flex flex-1 min-h-0">
        <WorkspaceRail />
        <div className="flex-1 min-w-0 flex flex-col">
          <DemoBanner />
          <TopMarketBar />
          <div className="flex-1 min-h-0 flex relative">
            {showSidePanels && <WatchlistPanel />}
            <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-bg relative">
              {/* Visual background noise - subtler grid */}
              <div className="absolute inset-0 term-grid pointer-events-none opacity-40 z-0" />
              <div className="flex-1 min-h-0 flex flex-col z-10">
                <WorkspaceContent />
              </div>
              {bottomDockOpen && <BottomDock />}
            </main>
            {showSidePanels && <RightTradePanel />}
          </div>
          <StatusBar />
        </div>
      </div>
      <CommandPalette />
      <KeyboardShortcutsOverlay />
    </div>
  )
}
