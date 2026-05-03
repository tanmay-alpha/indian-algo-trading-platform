'use client'

import { LockKeyhole, ShieldCheck, ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtPrice, fmtVolume } from '@/lib/utils'

export function OrderTicket() {
  const tick = useTerminalStore((s) => s.currentTick)
  const mode = useTerminalStore((s) => s.executionMode)
  const symbol = useTerminalStore((s) => s.selectedSymbol) ?? tick?.symbol

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        icon={<ShoppingCart className="w-4 h-4" />}
        title="Order Ticket"
        subtitle="Execution locked"
      />

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1">
          <button disabled className="h-8 rounded-md bg-up/15 text-up font-semibold text-xs">
            Buy
          </button>
          <button disabled className="h-8 rounded-md bg-down/15 text-down font-semibold text-xs">
            Sell
          </button>
        </div>

        <Field label="Symbol" value={symbol ?? '\u2014'} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantity" value={'\u2014'} disabled />
          <Field label="Order Type" value="Market" disabled />
          <Field label="Price" value={fmtPrice(tick?.ltp ?? tick?.price)} disabled />
          <Field label="Est. Notional" value={'\u2014'} disabled />
        </div>

        <div className="rounded-lg border border-warn/25 bg-warn-dim p-3">
          <div className="flex items-center gap-2 text-warn">
            <LockKeyhole className="w-4 h-4" />
            <span className="text-xs font-semibold">Execution locked</span>
          </div>
          <p className="mt-1 text-2xs font-mono leading-relaxed text-warn/90">
            Paper mode only. Live trading and broker order placement are disabled in this build.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-panel/70 p-3">
          <div className="flex items-center gap-2 text-text">
            <ShieldCheck className="w-4 h-4 text-info" />
            <span className="text-xs font-semibold">Risk preview</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniMetric label="Mode" value={mode} />
            <MiniMetric label="LTP" value={fmtPrice(tick?.ltp ?? tick?.price)} />
            <MiniMetric label="Volume" value={fmtVolume(tick?.volume)} />
            <MiniMetric label="Stale Rule" value="Active" />
          </div>
        </div>

        <button disabled className="w-full h-9 rounded-md border border-border bg-panel text-xs font-semibold text-text-dim">
          Order disabled by safety lock
        </button>
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
    <div className="h-12 px-3 flex items-center gap-2 border-b border-border bg-panel/40">
      <span className="text-info">{icon}</span>
      <div>
        <div className="text-xs font-semibold text-text">{title}</div>
        <div className="text-[10px] text-text-faint">{subtitle}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  disabled,
}: {
  label: string
  value: string
  disabled?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-bg p-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-text-faint">{label}</div>
      <div className={disabled ? 'mt-1 font-mono text-xs text-text-dim' : 'mt-1 font-mono text-xs text-text'}>
        {value}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-wider text-text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-xs text-text-2">{value}</div>
    </div>
  )
}
