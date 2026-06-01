'use client'

import { ShieldCheck, Lock, Eye, Brain } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, getNseMarketSession } from '@/lib/utils'
import { LivePulseDot } from '@/components/effects/live-pulse-dot'

export function SafetyStatusCard() {
  const wsStatus       = useTerminalStore((s) => s.wsStatus)
  const apiStatus      = useTerminalStore((s) => s.apiStatus)
  const backendOffline = useTerminalStore((s) => s.backendOffline)

  const isOnline    = apiStatus === 'ONLINE' && !backendOffline
  const isConnected = wsStatus === 'CONNECTED'

  return (
    <div className="w-full rounded-2xl border border-[#EA3943]/20 bg-[#EA3943]/5 p-4 relative overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#EA3943]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#EA3943]/10 border border-[#EA3943]/25 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#EA3943]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text leading-snug">Hardened Security Gating</h3>
          <p className="text-[11px] text-[#EA3943] font-semibold mt-0.5 tracking-wide">
            LIVE TRADING PERMANENTLY LOCKED
          </p>
        </div>
      </div>

      {/* Status Badges */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Lock className="w-4 h-4 text-[#EA3943] shrink-0" />
          <div>
            <div className="text-[10px] text-text-dim leading-none uppercase">Execution</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <LivePulseDot color="rose" size="sm" />
              <span className="text-xs font-bold text-[#EA3943]">LOCKED</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <ShieldCheck className="w-4 h-4 text-[#22D3EE] shrink-0" />
          <div>
            <div className="text-[10px] text-text-dim leading-none uppercase">Trading Mode</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <LivePulseDot color="emerald" size="sm" />
              <span className="text-xs font-bold text-[#22D3EE]">PAPER MODE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Eye className="w-4 h-4 text-[#3B82F6] shrink-0" />
          <div>
            <div className="text-[10px] text-text-dim leading-none uppercase">Broker Sync</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <LivePulseDot color="blue" size="sm" />
              <span className="text-xs font-bold text-[#3B82F6]">READ ONLY</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Brain className="w-4 h-4 text-[#F59E0B] shrink-0" />
          <div>
            <div className="text-[10px] text-text-dim leading-none uppercase">AI Copilot</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <LivePulseDot color="amber" size="sm" />
              <span className="text-xs font-bold text-[#F59E0B]">ADVISORY ONLY</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-text-dim leading-relaxed bg-black/20 rounded-xl p-3 border border-white/[0.03]">
        <span className="font-semibold text-text">Sandbox Policy:</span> Real-time feeds display verified read-only index/instrument tickers. Manual order submissions run dry-run validation checks on the backend risk-gate. No live capital is exposed or committed.
      </div>
    </div>
  )
}
