'use client'

import type { ReactNode } from 'react'
import { MobileTopHeader } from '@/components/mobile/mobile-top-header'
import { MobileBottomNav, type AppTab } from '@/components/mobile/mobile-bottom-nav'
import { HomeScreen } from '@/components/screens/home-screen'
import { WatchlistScreen } from '@/components/screens/watchlist-screen'
import { ChartScreen } from '@/components/screens/chart-screen'
import { PortfolioScreen } from '@/components/screens/portfolio-screen'
import { AiScreen } from '@/components/screens/ai-screen'
import { SystemScreen } from '@/components/screens/system-screen'

const SCREEN_TITLES: Record<AppTab, string> = {
  home: 'MAET',
  watchlist: 'Watchlist',
  chart: 'Chart',
  portfolio: 'Portfolio',
  ai: 'AI Advisory',
  system: 'System',
}

interface MobileTerminalShellProps {
  activeTab: AppTab
  onNavigate: (tab: AppTab) => void
}

export function MobileTerminalShell({ activeTab, onNavigate }: MobileTerminalShellProps) {
  return (
    <div className="mobile-app">
      <MobileTopHeader title={SCREEN_TITLES[activeTab]} onNavigate={onNavigate} />

      <div className="relative min-h-0 flex-1">
        <ScreenWrapper active={activeTab === 'home'}>
          <HomeScreen onNavigate={onNavigate} />
        </ScreenWrapper>
        <ScreenWrapper active={activeTab === 'watchlist'}>
          <WatchlistScreen onNavigate={onNavigate} />
        </ScreenWrapper>
        <ScreenWrapper active={activeTab === 'chart'}>
          <ChartScreen />
        </ScreenWrapper>
        <ScreenWrapper active={activeTab === 'portfolio'}>
          <PortfolioScreen />
        </ScreenWrapper>
        <ScreenWrapper active={activeTab === 'ai'}>
          <AiScreen />
        </ScreenWrapper>
        <ScreenWrapper active={activeTab === 'system'}>
          <SystemScreen />
        </ScreenWrapper>
      </div>

      <MobileBottomNav active={activeTab} onNavigate={onNavigate} />
    </div>
  )
}

function ScreenWrapper({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null
  return <div className="h-full fade-in">{children}</div>
}
