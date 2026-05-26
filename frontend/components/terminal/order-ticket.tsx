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
        {/* Keep all safety warnings visible */}
        <div className="border border-warn/25 bg-warn-dim p-3">
          <div className="flex items-center gap-2 text-warn">
            <LockKeyhole className="h-4 w-4" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">EXECUTION LOCKED</span>
          </div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-warn/90">
            Paper mode only. No real orders.
          </p>
        </div>

        {/* Compact locked message */}
        {!showDetails && (
          <div className="rounded border border-border bg-panel/30 p-2.5 text-center">
            <p className="font-mono text-[10px] text-text-faint leading-normal">
              Order input fields are collapsed by default because execution is disabled. Toggle below to review schema.
            </p>
          </div>
        )}

        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full h-7 border border-border/80 hover:bg-panel rounded flex items-center justify-center gap-1 text-[10px] font-mono text-text-dim hover:text-text transition-colors"
        >
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span>{showDetails ? 'Hide ticket details' : 'Show ticket details'}</span>
        </button>

        {/* Detailed fields collapsed by default */}
        {showDetails && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-1 border border-border bg-bg p-1">
              <button
                disabled
                title="Execution disabled in this build"
                className="h-8 cursor-not-allowed border border-up/20 bg-up/10 font-mono text-[11px] font-semibold text-up/50"
              >
                Buy
              </button>
              <button
                disabled
                title="Execution disabled in this build"
                className="h-8 cursor-not-allowed border border-down/20 bg-down/10 font-mono text-[11px] font-semibold text-down/50"
              >
                Sell
              </button>
            </div>

            <Field label="Symbol" value={symbol ?? '—'} />
            <div className="grid grid-cols-2 border border-border">
              <Field label="Quantity" value="—" disabled flush />
              <Field label="Order Type" value="Market" disabled flush />
              <Field label="Price" value={fmtPrice(tick?.ltp ?? tick?.price)} disabled flush />
              <Field label="Est. Notional" value="—" disabled flush />
            </div>

            <div className="border border-border bg-panel/50 p-3">
              <div className="flex items-center gap-2 text-text">
                <ShieldCheck className="h-4 w-4 text-info" />
                <span className="text-[11px] font-semibold">Risk preview</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniMetric label="Mode" value={mode} />
                <MiniMetric label="LTP" value={fmtPrice(tick?.ltp ?? tick?.price)} />
                <MiniMetric label="Volume" value={fmtVolume(tick?.volume)} />
                <MiniMetric label="Stale Rule" value="Active" />
              </div>
            </div>

            <button
              disabled
              title="Execution disabled in this build"
              className="h-9 w-full cursor-not-allowed border border-border bg-panel font-mono text-[11px] font-semibold text-text-dim"
            >
              Order disabled by safety lock
            </button>
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
