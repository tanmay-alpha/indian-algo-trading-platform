'use client'

import { useTerminalStore } from '@/store/terminal-store'
import { RIGHT_TABS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { OrderTicket } from './order-ticket'
import { SymbolDetails } from './symbol-details'
import { RiskPreview } from './risk-preview'
import { StrategySignalPanel } from './strategy-signal-panel'
import { JournalNotesPanel } from './journal-notes-panel'
import { SafetyBadgeGroup } from './safety-badge'

export function RightTradePanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const tab = useTerminalStore((s) => s.rightPanelTab)
  const setTab = useTerminalStore((s) => s.setRightPanelTab)
  const selected = useTerminalStore((s) => s.selectedSymbol)

  return (
    <aside
      aria-label="Symbol intelligence drawer"
      className={cn("w-drawer shrink-0 h-full bg-bg-2/80 backdrop-blur-md border-l border-[#38bdf8]/10 flex flex-col shadow-panel glass-panel", className)}
    >
      <div className="px-3 py-2 border-b border-border bg-panel/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text uppercase tracking-wider">Intelligence</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-info">{selected ?? '---'}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/5 text-text-faint hover:text-text transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-start gap-1 overflow-x-auto scrollbar-none select-none">
          <SafetyBadgeGroup size="xs" className="flex-nowrap" />
        </div>
      </div>
      <div className="flex border-b border-border bg-bg h-8 shrink-0">
        {RIGHT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 text-xs font-mono uppercase tracking-tight transition-colors border-b-2',
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
