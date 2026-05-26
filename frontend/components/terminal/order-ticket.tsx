'use client'

import { useState } from 'react'
import { LockKeyhole, ShieldCheck, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtPrice, fmtVolume } from '@/lib/utils'

export function OrderTicket() {
  const tick = useTerminalStore((s) => s.currentTick)
  const mode = useTerminalStore((s) => s.executionMode)
  const symbol = useTerminalStore((s) => s.selectedSymbol) ?? tick?.symbol
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        icon={<ShoppingCart className="h-4 w-4" />}
        title="Order Ticket"
        subtitle="Execution locked"
      />

      <div className="space-y-3 p-3">
        {/* Compact safety warning */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm border border-warn/30 bg-warn/5 text-warn">
          <LockKeyhole className="h-3 w-3" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-tight">Paper Mode Only</span>
        </div>

        {/* Action Toggle */}
        {!showDetails && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button disabled className="h-9 rounded-sm border border-up/20 bg-up/5 text-up/40 font-bold uppercase text-[11px] cursor-not-allowed">Buy</button>
              <button disabled className="h-9 rounded-sm border border-down/20 bg-down/5 text-down/40 font-bold uppercase text-[11px] cursor-not-allowed">Sell</button>
            </div>
            <p className="text-[10px] text-text-faint text-center italic font-mono leading-tight px-2">
              Order inputs are locked. Real trading is disabled in this build.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-1 text-[9px] font-mono uppercase tracking-widest text-text-faint hover:text-text-dim transition-colors flex items-center justify-center gap-1.5"
        >
          <div className="h-px flex-1 bg-border/40" />
          {showDetails ? 'Hide Schema' : 'Review Schema'}
          <div className="h-px flex-1 bg-border/40" />
        </button>

        {/* Detailed fields collapsed by default */}
        {showDetails && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-px bg-border border border-border rounded-sm overflow-hidden">
              <Field label="Symbol" value={symbol ?? '—'} flush />
              <Field label="Type" value="Market" flush />
              <Field label="Qty" value="---" flush />
              <Field label="Est. Prc" value={fmtPrice(tick?.ltp ?? tick?.price)} flush />
            </div>

            <div className="border border-border bg-panel/30 p-2.5 rounded-sm">
              <div className="flex items-center gap-1.5 text-text-dim mb-2">
                <ShieldCheck className="h-3 w-3 text-info" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Risk Gate</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2">
                <MiniMetric label="Exposure" value="0.00" />
                <MiniMetric label="Stale Data" value="ENFORCED" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PanelHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-border bg-panel/40 px-3">
      <span className="text-info">{icon}</span>
      <div>
        <div className="text-[11px] font-semibold text-text">{title}</div>
        <div className="text-[9px] text-text-faint">{subtitle}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  disabled,
  flush,
}: {
  label: string
  value: string
  disabled?: boolean
  flush?: boolean
}) {
  return (
    <div className={flush ? 'border-b border-r border-border bg-bg p-2' : 'border border-border bg-bg p-2'}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-text-faint">{label}</div>
      <div className={disabled ? 'mt-1 font-mono text-[11px] text-text-dim' : 'mt-1 font-mono text-[11px] text-text'}>
        {value}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-text-2">{value}</div>
    </div>
  )
}
