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
      className="w-drawer shrink-0 h-full bg-bg-2 border-l border-border flex flex-col"
    >
      <div className="flex border-b border-border bg-panel/30">
        {RIGHT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 h-9 text-2xs font-mono uppercase tracking-wider transition-colors border-b-2',
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
