'use client'

import { useEffect, useState } from 'react'
import { DesktopSidebar } from './desktop-sidebar'
import { TopStatusBar } from './top-status-bar'
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
import { MobileHeader } from './mobile-header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { AppShell } from './app-shell'

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

  const [mobileWatchlistOpen, setMobileWatchlistOpen] = useState(false)
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false)

  // Automatically close drawers on workspace switch
  useEffect(() => {
    setMobileWatchlistOpen(false)
    setMobileRightPanelOpen(false)
  }, [activeWorkspace])

  return (
    <AppShell
      sidebar={<DesktopSidebar />}
      topBar={<TopStatusBar />}
      mobileHeader={
        <MobileHeader
          onOpenWatchlist={() => setMobileWatchlistOpen((open) => !open)}
          onOpenRightPanel={() => setMobileRightPanelOpen((open) => !open)}
        />
      }
      mobileNav={<MobileBottomNav />}
      statusBar={<StatusBar />}
      demoBanner={<DemoBanner />}
      drawers={
        <>
          {/* Mobile Drawers */}
          {showSidePanels && mobileWatchlistOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setMobileWatchlistOpen(false)}
              />
              <div className="relative w-[280px] max-w-[85vw] h-full bg-bg-2 shadow-2xl flex flex-col border-r border-border animate-in slide-in-from-left duration-200">
                <WatchlistPanel
                  className="w-full border-r-0"
                  onClose={() => setMobileWatchlistOpen(false)}
                />
              </div>
            </div>
          )}

          {showSidePanels && mobileRightPanelOpen && (
            <div className="fixed inset-0 z-50 flex justify-end md:hidden">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setMobileRightPanelOpen(false)}
              />
              <div className="relative w-[320px] max-w-[85vw] h-full bg-bg-2 shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
                <RightTradePanel
                  className="w-full border-l-0"
                  onClose={() => setMobileRightPanelOpen(false)}
                />
              </div>
            </div>
          )}
        </>
      }
      overlays={
        <>
          <CommandPalette />
          <KeyboardShortcutsOverlay />
        </>
      }
    >
      {showSidePanels && <WatchlistPanel className="hidden md:flex" />}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-bg relative">
        {/* Visual background noise - subtler grid */}
        <div className="absolute inset-0 term-grid pointer-events-none opacity-40 z-0" />
        <div className="flex-1 min-h-0 flex flex-col z-10">
          <WorkspaceContent />
        </div>
        {bottomDockOpen && <BottomDock />}
      </main>
      {showSidePanels && <RightTradePanel className="hidden md:flex" />}
    </AppShell>
  )
}
