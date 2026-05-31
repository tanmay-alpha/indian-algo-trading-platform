'use client'

import { PortfolioWorkspace } from '@/components/workspaces/workspace-content'
import { GlassPanel } from '@/components/maet/glass-panel'

export function PortfolioScreen() {
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <h2 className="text-sm font-bold tracking-tight text-white mb-3">PORTFOLIO & RISK RECONCILIATION</h2>
      <div className="flex-1">
        <GlassPanel className="h-full bg-transparent border-none p-0 shadow-none">
          <PortfolioWorkspace />
        </GlassPanel>
      </div>
    </div>
  )
}
