'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { RIGHT_TABS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { OrderTicket } from './order-ticket'
import { SymbolDetails } from './symbol-details'
import { RiskPreview } from './risk-preview'
import { StrategySignalPanel } from './strategy-signal-panel'
import { JournalNotesPanel } from './journal-notes-panel'

export function RightTradePanel() {
  const tab = useTerminalStore((s) => s.rightPanelTab)
  const setTab = useTerminalStore((s) => s.setRightPanelTab)

  return (
    <aside
      aria-label="Symbol intelligence drawer"
      className="w-drawer shrink-0 h-full bg-bg-2 border-l border-border flex flex-col shadow-panel"
    >
      <div className="px-3 py-2 border-b border-border bg-panel/40">
        <div className="text-xs font-semibold text-text">Symbol Command</div>
        <div className="text-[10px] text-text-faint">Order, risk, signals, and notes</div>
      </div>
      <div className="flex border-b border-border bg-bg">
        {RIGHT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 h-8 text-2xs font-medium transition-colors border-b-2',
              tab === t.id
                ? 'text-info border-info bg-info/[0.06]'
                : 'text-text-dim border-transparent hover:text-text hover:bg-white/[0.03]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'order' && <OrderTicket />}
        {tab === 'symbol' && <SymbolDetails />}
        {tab === 'risk' && <RiskPreview />}
        {tab === 'signals' && <StrategySignalPanel />}
        {tab === 'notes' && <JournalNotesPanel />}
      </div>
    </aside>
  )
}
