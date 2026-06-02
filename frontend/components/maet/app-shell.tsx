'use client'

import type { ReactNode } from 'react'

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
    <div className="h-screen flex flex-col bg-[#07090e] text-white overflow-hidden select-none font-sans antialiased">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Main outer structure */}
      <div className="flex flex-1 min-h-0 z-10 relative">
        {/* Desktop Sidebar (Left Rail) */}
        {sidebar}

        <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
          {/* Demo/Disclaimer Banner at top */}
          {demoBanner}

          {/* Desktop Top Bar */}
          <div className="hidden md:block">
            {topBar}
          </div>

          {/* Mobile Header (rendered on top for small viewports) */}
          <div className="md:hidden">
            {mobileHeader || topBar}
          </div>

          {/* Core App Space */}
          <div className="flex-1 min-h-0 flex relative overflow-hidden">
            {children}
          </div>

          {/* Desktop Footer Status Bar */}
          <div className="hidden md:block">
            {statusBar}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Navigation Menu */}
      {mobileNav}

      {/* Slide-out Drawers for mobile */}
      {drawers}

      {/* Overlays / Portals */}
      {overlays}
    </div>
  )
}
