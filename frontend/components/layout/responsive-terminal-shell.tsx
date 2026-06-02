'use client'

import { useState } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { MobileTerminalShell } from './mobile-terminal-shell'
import { DesktopTerminalShell } from './desktop-terminal-shell'

export function ResponsiveTerminalShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')

  return (
    <>
      <div className="lg:hidden h-dvh" data-shell="mobile">
        <MobileTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
      </div>
      <div className="hidden lg:block" data-shell="desktop">
        <DesktopTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
      </div>
    </>
  )
}
