'use client'

import { useState, useCallback } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { MobileTerminalShell } from './mobile-terminal-shell'
import { DesktopTerminalShell } from './desktop-terminal-shell'
import { PremiumBackground } from '@/components/effects/premium-background'
import { useWindowSize } from '@/lib/use-window-size'

export function ResponsiveTerminalShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const { isDesktop } = useWindowSize()
  const [previousTab, setPreviousTab] = useState<AppTab>('home')

  const handleNavigate = useCallback((tab: AppTab) => {
    setPreviousTab(activeTab)
    setActiveTab(tab)
  }, [activeTab])

  // For non-JS or initial load, use CSS breakpoints (lg: hidden/block)
  // The JS hook provides explicit control and prevents hydration issues

  return (
    <div className="maet-page-bg relative h-[calc(100dvh-var(--safety-strip-h))] overflow-hidden text-maet-text">
      <PremiumBackground />
      {/* Use JS detection primarily, fall back to CSS for no-JS */}
      <div
        className="relative h-full"
        data-shell="mobile"
        style={{ display: isDesktop ? 'none' : 'block' }}
        data-hidden-desktop="true"
      >
        <MobileTerminalShell
          activeTab={activeTab}
          onNavigate={handleNavigate}
          previousTab={previousTab}
        />
      </div>
      <div
        className="relative hidden h-full"
        data-shell="desktop"
        style={{ display: isDesktop ? 'block' : 'none' }}
        data-hidden-mobile="true"
      >
        <DesktopTerminalShell activeTab={activeTab} onNavigate={handleNavigate} />
      </div>
    </div>
  )
}
