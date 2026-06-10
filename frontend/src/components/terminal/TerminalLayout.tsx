'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart2,
  Briefcase,
  LayoutGrid,
  ListFilter,
  MoreHorizontal,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { ChartArea } from '@/components/chart/ChartArea'
import { BottomTabs } from '@/components/terminal/BottomTabs'
import { OrderPanel } from '@/components/terminal/OrderPanel'
import { StatusBar } from '@/components/terminal/StatusBar'
import { TopBar } from '@/components/terminal/TopBar'
import { WatchlistPanel } from '@/components/terminal/WatchlistPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { ErrorBoundary } from '@/components/effects/error-boundary'
import { cn } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal-store'
import type { WorkspaceId } from '@/lib/types'

type MobileTab = 'home' | 'watchlist' | 'chart' | 'portfolio' | 'more'

const mobileTabs: { id: MobileTab; label: string; icon: typeof BarChart2 }[] = [
  { id: 'home', label: 'Home', icon: LayoutGrid },
  { id: 'watchlist', label: 'Watchlist', icon: ListFilter },
  { id: 'chart', label: 'Chart', icon: BarChart2 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

export function TerminalLayout() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart')
  useWebSocket()

  return (
    <main className="flex h-[100dvh] select-none flex-col overflow-hidden bg-base text-text-primary">
      <TopBar />

      <div className="hidden min-h-0 flex-1 md:flex">
        <TerminalSidebar />
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
          {mobileTab === 'home' && (
            <ErrorBoundary boundaryName="Mobile home">
              <ChartArea className="h-full" />
            </ErrorBoundary>
          )}
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
          {mobileTab === 'portfolio' && (
            <ErrorBoundary boundaryName="Mobile portfolio">
              <BottomTabs className="h-full border-t-0" />
            </ErrorBoundary>
          )}
          {mobileTab === 'more' && (
            <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
              <div className="rounded border border-border bg-panel p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">System</div>
                <div className="mt-2 text-sm text-text-primary">Paper mode workspace, demo feed fallback, and status diagnostics.</div>
              </div>
              <Link href="/terminal/strategy" className="rounded border border-accent/35 bg-accent-dim px-3 py-2 font-mono text-[11px] text-accent">
                Strategy Lab
              </Link>
              <Link href="/docs" className="rounded border border-border bg-surface px-3 py-2 font-mono text-[11px] text-text-muted">
                User docs
              </Link>
            </div>
          )}
        </div>

        <nav
          className="grid h-[56px] shrink-0 grid-cols-5 border-t border-border bg-panel pb-[env(safe-area-inset-bottom)]"
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

      <StatusBar />
    </main>
  )
}

const sidebarItems: Array<{
  id: WorkspaceId | 'strategy-route'
  label: string
  icon: typeof LayoutGrid
  href?: string
}> = [
  { id: 'trade', label: 'Home', icon: LayoutGrid },
  { id: 'markets', label: 'Watchlist', icon: TrendingUp },
  { id: 'journal', label: 'Chart', icon: BarChart2 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'strategy-route', label: 'Strategy', icon: ListFilter, href: '/terminal/strategy' },
  { id: 'oms', label: 'System', icon: Settings },
]

function TerminalSidebar() {
  const activeWorkspace = useTerminalStore((state) => state.activeWorkspace)
  const setWorkspace = useTerminalStore((state) => state.setWorkspace)

  return (
    <nav className="flex w-[76px] shrink-0 flex-col border-r border-border bg-panel py-3" aria-label="Terminal sections">
      <div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[0.08em] text-text-hint">Desk</div>
      <div className="space-y-1 px-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon
          const active = activeWorkspace === item.id
          const className = cn(
            'flex h-[54px] w-full flex-col items-center justify-center gap-1 border-l-2 border-transparent px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-text-muted transition-colors hover:bg-accent-soft hover:text-accent',
            active && 'border-l-accent bg-accent-soft text-accent'
          )

          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className={className}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            )
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setWorkspace(item.id as WorkspaceId)}
              className={className}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
