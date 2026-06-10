'use client'

import { useState } from 'react'
import { Activity, BarChart3, ClipboardList, ListFilter, MoreHorizontal } from 'lucide-react'
import { ChartArea } from '@/components/chart/ChartArea'
import { PaperTradingBanner } from '@/components/compliance/PaperTradingBanner'
import { ProductRiskFooter } from '@/components/compliance/ProductRiskFooter'
import { BottomTabs } from '@/components/terminal/BottomTabs'
import { OrderPanel } from '@/components/terminal/OrderPanel'
import { StatusBar } from '@/components/terminal/StatusBar'
import { TopBar } from '@/components/terminal/TopBar'
import { WatchlistPanel } from '@/components/terminal/WatchlistPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { ErrorBoundary } from '@/components/effects/error-boundary'
import { cn } from '@/lib/utils'

type MobileTab = 'watchlist' | 'chart' | 'order' | 'activity' | 'more'

const mobileTabs: { id: MobileTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'watchlist', label: 'Watchlist', icon: ListFilter },
  { id: 'chart', label: 'Chart', icon: BarChart3 },
  { id: 'order', label: 'Order', icon: ClipboardList },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

export function TerminalLayout() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart')
  useWebSocket()

  return (
    <main className="flex h-[100dvh] select-none flex-col overflow-hidden bg-base text-text-primary">
      <TopBar />
      <PaperTradingBanner />

      <div className="hidden min-h-0 flex-1 md:flex">
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

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          {mobileTab === 'watchlist' && (
            <ErrorBoundary boundaryName="Mobile watchlist">
              <WatchlistPanel className="h-full w-full border-r-0" />
            </ErrorBoundary>
          )}
          {mobileTab === 'chart' && (
            <ErrorBoundary boundaryName="Mobile chart">
              <ChartArea className="h-full" />
            </ErrorBoundary>
          )}
          {mobileTab === 'order' && (
            <ErrorBoundary boundaryName="Mobile order ticket">
              <OrderPanel className="h-full w-full border-l-0" />
            </ErrorBoundary>
          )}
          {mobileTab === 'activity' && (
            <ErrorBoundary boundaryName="Mobile activity">
              <BottomTabs className="h-full border-t-0" />
            </ErrorBoundary>
          )}
          {mobileTab === 'more' && (
            <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
              <div className="rounded border border-border bg-panel p-3">
                <div className="font-mono text-[11px] uppercase tracking-wide text-text-muted">System</div>
                <div className="mt-2 text-sm text-text-primary">
                  Paper mode, broker sync, and safety controls are read-only in this deployment.
                </div>
              </div>
              <ProductRiskFooter compact />
            </div>
          )}
        </div>

        <nav
          className="grid h-[64px] shrink-0 grid-cols-5 border-t border-border bg-panel pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile terminal navigation"
        >
          {mobileTabs.map((tab) => {
            const Icon = tab.icon
            const active = mobileTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 border-t-2 border-transparent font-mono text-[9px] text-text-muted',
                  active && 'border-accent text-accent'
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <ProductRiskFooter compact />
      <StatusBar />
    </main>
  )
}
