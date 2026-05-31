'use client'

import { TradeWorkspace } from '@/components/workspaces/workspace-content'
import { GlassPanel } from '@/components/maet/glass-panel'

export function ChartScreen() {
  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <h2 className="text-sm font-bold tracking-tight text-white mb-3">CHART ANALYSIS</h2>
      <div className="flex-1 min-h-0">
        <GlassPanel className="h-full flex flex-col overflow-hidden">
          <TradeWorkspace />
        </GlassPanel>
      </div>
    </div>
  )
}
