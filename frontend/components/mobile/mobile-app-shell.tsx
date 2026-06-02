'use client'

import { useState } from 'react'
import { MobileTerminalShell } from '@/components/layout/mobile-terminal-shell'
import type { AppTab } from './mobile-bottom-nav'

export function MobileAppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')

  return <MobileTerminalShell activeTab={activeTab} onNavigate={setActiveTab} />
}
