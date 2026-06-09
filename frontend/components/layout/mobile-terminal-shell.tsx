'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { MobileTopHeader } from '@/components/mobile/mobile-top-header'
import { MobileBottomNav, type AppTab } from '@/components/mobile/mobile-bottom-nav'
import { HomeScreen } from '@/components/screens/home-screen'
import { WatchlistScreen } from '@/components/screens/watchlist-screen'
import { ChartScreen } from '@/components/screens/chart-screen'
import { PortfolioScreen } from '@/components/screens/portfolio-screen'
import { AiScreen } from '@/components/screens/ai-screen'
import { SystemScreen } from '@/components/screens/system-screen'
import { useSwipeGesture } from '@/lib/use-swipe-gesture'

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
  previousTab?: AppTab
}

export function MobileTerminalShell({ activeTab, onNavigate, previousTab = 'home' }: MobileTerminalShellProps) {
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => handleSwipeLeft(),
    onSwipeRight: () => handleSwipeRight(),
  })

  // Determine swipe direction based on tab navigation
  const handleSwipeLeft = () => {
    const tabOrder: AppTab[] = ['home', 'watchlist', 'chart', 'portfolio', 'ai', 'system']
    const currentIndex = tabOrder.indexOf(activeTab)
    const nextTab = tabOrder[currentIndex + 1]
    if (nextTab) {
      onNavigate(nextTab)
    }
  }

  const handleSwipeRight = () => {
    const tabOrder: AppTab[] = ['home', 'watchlist', 'chart', 'portfolio', 'ai', 'system']
    const currentIndex = tabOrder.indexOf(activeTab)
    const prevTab = tabOrder[currentIndex - 1]
    if (prevTab) {
      onNavigate(prevTab)
    }
  }

  // Update previousTab when activeTab changes
  const activeTabRef = useRef(activeTab)
  if (activeTabRef.current !== activeTab) {
    previousTab = activeTabRef.current
    activeTabRef.current = activeTab
  }

  return (
    <div className="mobile-app flex flex-col">
      <MobileTopHeader title={SCREEN_TITLES[activeTab]} onNavigate={onNavigate} />

      <div className="mobile-tab-content relative min-h-0 flex-1">
        {/* Swipe container */}
        <div
          className="mobile-screen h-full"
          {...swipeHandlers}
          data-tab={activeTab}
        >
          {/* Animated content */}
          <div className={`mobile-screen ${activeTab === previousTab ? '' : 'fade-in'}`}>
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
        </div>
      </div>

      <MobileBottomNav active={activeTab} onNavigate={onNavigate} />
    </div>
  )
}

function ScreenWrapper({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null
  return <div className="mobile-tab-content h-full">{children}</div>
}
