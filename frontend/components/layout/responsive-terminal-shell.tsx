'use client'

import { useState } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { MobileTerminalShell } from './mobile-terminal-shell'
import { DesktopTerminalShell } from './desktop-terminal-shell'
import { PremiumBackground } from '@/components/effects/premium-background'

export function ResponsiveTerminalShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')

  return (
    <div className="maet-page-bg relative h-[calc(100dvh-var(--safety-strip-h))] overflow-hidden text-maet-text">
      <PremiumBackground />
      <div className="relative h-full lg:hidden" data-shell="mobile">
        <MobileTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
      </div>
      <div className="relative hidden h-full lg:block" data-shell="desktop">
        <DesktopTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
      </div>
    </div>
  )
}
