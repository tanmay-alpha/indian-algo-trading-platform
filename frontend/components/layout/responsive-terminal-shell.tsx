'use client'

import { useState } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { MobileTerminalShell } from './mobile-terminal-shell'
import { DesktopTerminalShell } from './desktop-terminal-shell'
import { LiquidBackground } from '@/components/effects/liquid-background'

export function ResponsiveTerminalShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')

  return (
    <div className="relative h-[calc(100dvh-var(--safety-strip-h))] overflow-hidden bg-maet-bg-deep text-maet-text">
      <LiquidBackground intensity="standard" />
      <div className="relative h-full lg:hidden" data-shell="mobile">
        <MobileTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
      </div>
      <div className="relative hidden h-full lg:block" data-shell="desktop">
        <DesktopTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
      </div>
    </div>
  )
}
