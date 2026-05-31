'use client'

import { useState, type ReactNode } from 'react'
import { MobileTopHeader } from './mobile-top-header'
import { MobileBottomNav, type AppTab } from './mobile-bottom-nav'
import { HomeScreen }      from '@/components/screens/home-screen'
import { WatchlistScreen } from '@/components/screens/watchlist-screen'
import { ChartScreen }     from '@/components/screens/chart-screen'
import { PortfolioScreen } from '@/components/screens/portfolio-screen'
import { AiScreen }        from '@/components/screens/ai-screen'
import { SystemScreen }    from '@/components/screens/system-screen'

const SCREEN_TITLES: Record<AppTab, string> = {
  home:      'MAET',
  watchlist: 'Watchlist',
  chart:     'Chart',
  portfolio: 'Portfolio',
  ai:        'AI Advisory',
  system:    'Telemetry',
}

export function MobileAppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')

  const title = SCREEN_TITLES[activeTab]

  return (
    <div className="mobile-app">
      <MobileTopHeader title={title} />

      {/* Screen content — only render active */}
      <div className="flex-1 min-h-0 relative">
        <ScreenWrapper active={activeTab === 'home'}>
          <HomeScreen onNavigate={setActiveTab} />
        </ScreenWrapper>
        <ScreenWrapper active={activeTab === 'watchlist'}>
          <WatchlistScreen onNavigate={setActiveTab} />
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

      <MobileBottomNav active={activeTab} onNavigate={setActiveTab} />
    </div>
  )
}

function ScreenWrapper({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null
  return <div className="h-full">{children}</div>
}
