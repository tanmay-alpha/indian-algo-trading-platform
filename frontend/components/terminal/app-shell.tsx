'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppShellProps {
  sidebar?: ReactNode
  topBar?: ReactNode
  mobileHeader?: ReactNode
  mobileNav?: ReactNode
  statusBar?: ReactNode
  demoBanner?: ReactNode
  drawers?: ReactNode
  overlays?: ReactNode
  children: ReactNode
}

export function AppShell({
  sidebar,
  topBar,
  mobileHeader,
  mobileNav,
  statusBar,
  demoBanner,
  drawers,
  overlays,
  children,
}: AppShellProps) {
  return (
    <div className="h-screen flex flex-col bg-bg text-text overflow-hidden select-none">
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        {sidebar}

        <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
          {/* Demo/Disclaimer Banner */}
          {demoBanner}

          {/* Desktop Top Bar */}
          <div className="hidden md:block">
            {topBar}
          </div>

          {/* Mobile Header */}
          {mobileHeader}

          {/* Main workspace container */}
          <div className="flex-1 min-h-0 flex relative">
            {children}
          </div>

          {/* Desktop Status Bar */}
          {statusBar}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {mobileNav}

      {/* Drawer menus (Mobile) */}
      {drawers}

      {/* Shortcuts/Command palettes overlays */}
      {overlays}
    </div>
  )
}
