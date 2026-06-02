'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { ShieldCheck, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrokerStatusCard() {
  const brokerStatus = useTerminalStore((s) => s.brokerStatus)

  const isConnected = brokerStatus?.logged_in ?? false
  const brokerName = brokerStatus?.configured ? 'Zerodha Kite' : 'Reconciled Account'
  const clientName = brokerStatus?.logged_in ? 'ACTIVE SESSION' : 'READ ONLY GATEWAY'
  const reconciledAt = new Date().toISOString()

  return (
    <div className="glass-card-3d rounded-lg p-4 border border-[#38bdf8]/10 text-left select-none relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#a855f7]/10 flex items-center justify-center border border-[#a855f7]/20 text-[#c084fc]">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-white tracking-wider uppercase">Broker Status</h4>
            <p className="text-[10px] font-mono text-text-dim">Read-only connection</p>
          </div>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest font-semibold flex items-center gap-1",
          isConnected 
            ? "border border-purple-500/30 bg-purple-500/10 text-purple-400" 
            : "border border-border bg-panel-3 text-text-dim"
        )}>
          <span className={cn("w-1 h-1 rounded-full", isConnected ? "bg-purple-400 animate-pulse" : "bg-text-dim")} />
          RECONCILED
        </span>
      </div>

      {/* Card Content */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-white/[0.01] p-2 rounded border border-white/[0.02]">
            <span className="text-[10px] text-text-faint block uppercase">Gateway</span>
            <span className="font-semibold text-white truncate block">{brokerName}</span>
          </div>
          <div className="bg-white/[0.01] p-2 rounded border border-white/[0.02]">
            <span className="text-[10px] text-text-faint block uppercase">Client ID</span>
            <span className="font-semibold text-white truncate block">{clientName}</span>
          </div>
        </div>

        <div className="bg-white/[0.01] p-2.5 rounded border border-white/[0.02] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-text-faint block uppercase">Connection Mode</span>
            <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Mutation Disabled
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-text-faint block uppercase font-mono">Last Reconciled</span>
            <span className="text-[10px] text-text-dim font-mono block mt-0.5">
              {new Date(reconciledAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
