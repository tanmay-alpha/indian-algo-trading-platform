'use client'

import { Header } from './header'
import { MarketStrip } from './market-strip'
import { WatchlistPanel } from './watchlist-panel'
import { ChartWorkspace } from './chart-workspace'
import { OrderTicket } from './order-ticket'
import { DockTabs } from './dock-tabs'
import { StatusBar } from './status-bar'

export function TerminalLayout() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <Header />

      {/* Market Index Strip */}
      <MarketStrip />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Watchlist */}
        <aside className="w-64 shrink-0">
          <WatchlistPanel />
        </aside>

        {/* Center - Chart Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ChartWorkspace />
          </div>

          {/* Bottom Dock Tabs */}
          <DockTabs />
        </main>

        {/* Right Sidebar - Order Ticket */}
        <aside className="w-72 shrink-0">
          <OrderTicket />
        </aside>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
