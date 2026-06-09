'use client'

import { ChartArea } from '@/components/chart/ChartArea'
import { BottomTabs } from '@/components/terminal/BottomTabs'
import { OrderPanel } from '@/components/terminal/OrderPanel'
import { StatusBar } from '@/components/terminal/StatusBar'
import { TopBar } from '@/components/terminal/TopBar'
import { WatchlistPanel } from '@/components/terminal/WatchlistPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SebiWarningBanner } from '@/components/ui-maet/sebi-warning-banner'
import { ErrorBoundary } from '@/components/effects/error-boundary'

export function TerminalLayout() {
  useWebSocket()

  return (
    <main className="flex h-screen select-none flex-col overflow-hidden bg-base text-text-primary">
      <SebiWarningBanner />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ErrorBoundary boundaryName="Watchlist panel">
          <WatchlistPanel />
        </ErrorBoundary>
        <div className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary boundaryName="Chart workspace">
            <ChartArea />
          </ErrorBoundary>
          <ErrorBoundary boundaryName="Terminal tabs">
            <BottomTabs />
          </ErrorBoundary>
        </div>
        <ErrorBoundary boundaryName="Order panel">
          <OrderPanel />
        </ErrorBoundary>
      </div>
      <StatusBar />
    </main>
  )
}
