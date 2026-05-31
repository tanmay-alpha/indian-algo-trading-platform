'use client'

import { WatchlistPanel } from '@/components/terminal/watchlist-panel'
import { GlassPanel } from '@/components/maet/glass-panel'

export function WatchlistScreen() {
  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <h2 className="text-sm font-bold tracking-tight text-white mb-3">WATCHLIST WORKSPACE</h2>
      <div className="flex-1 min-h-0">
        <GlassPanel className="h-full flex flex-col overflow-hidden">
          <WatchlistPanel className="w-full border-r-0 bg-transparent glass-panel-none shadow-none" />
        </GlassPanel>
      </div>
    </div>
  )
}
