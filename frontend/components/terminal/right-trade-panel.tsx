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
  const selected = useTerminalStore((s) => s.selectedSymbol)

  return (
    <aside
      aria-label="Symbol intelligence drawer"
      className="w-drawer shrink-0 h-full bg-bg-2 border-l border-border flex flex-col shadow-panel"
    >
      <div className="px-3 py-2 border-b border-border bg-panel/30">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-text uppercase tracking-wider">Intelligence</span>
          <span className="text-[10px] font-mono font-medium text-info">{selected ?? '---'}</span>
        </div>
      </div>
      <div className="flex border-b border-border bg-bg h-8 shrink-0">
        {RIGHT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 text-[10px] font-mono uppercase tracking-tight transition-colors border-b-2',
              tab === t.id
                ? 'text-info border-info bg-info/5'
                : 'text-text-faint border-transparent hover:text-text hover:bg-white/[0.03]'
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
