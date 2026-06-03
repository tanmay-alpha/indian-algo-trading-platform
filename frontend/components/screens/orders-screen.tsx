'use client'

import { OmsWorkspace } from '@/components/workspaces/workspace-content'
import { OrderDryRunCard } from '@/components/maet/order-dry-run-card'
import { GlassPanel } from '@/components/maet/glass-panel'

export function OrdersScreen() {
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto space-y-4">
      <h2 className="text-sm font-bold tracking-tight text-white">OMS BLOTTER & ORDER ENTRY</h2>
      
      <div className="grid grid-cols-1 gap-4">
        <OrderDryRunCard />
      </div>

      <div className="flex-1 min-h-[400px]">
        <GlassPanel className="h-full flex flex-col overflow-hidden">
          <div className="h-9 px-3 flex items-center border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-xs font-mono font-semibold tracking-wider text-text-dim uppercase">ORDER BLOTTER</span>
          </div>
          <div className="flex-1 min-h-0">
            <OmsWorkspace />
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
