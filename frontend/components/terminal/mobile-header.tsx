'use client'

import { useEffect, useState } from 'react'
import { List, Zap, LockKeyhole, Info } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, getNseMarketSession, fmtPrice } from '@/lib/utils'
import { useIstClock } from '@/lib/use-ist-clock'
import { WORKSPACES } from '@/lib/constants'
import { SafetyBadgeGroup } from './safety-badge'

interface MobileHeaderProps {
  onOpenWatchlist: () => void
  onOpenRightPanel: () => void
}

export function MobileHeader({ onOpenWatchlist, onOpenRightPanel }: MobileHeaderProps) {
  const [mounted, setMounted] = useState(false)
  const activeWorkspace = useTerminalStore((s) => s.activeWorkspace)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const market = useTerminalStore((s) => s.marketWatch)
  const currentTick = useTerminalStore((s) => s.currentTick)
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const executionMode = useTerminalStore((s) => s.executionMode)
  const istTime = useIstClock()

  useEffect(() => {
    setMounted(true)
  }, [])

  const workspaceName = WORKSPACES.find((w) => w.id === activeWorkspace)?.label ?? activeWorkspace
  const row = selectedSymbol ? market[selectedSymbol] : null
  const ltp = currentTick?.ltp ?? currentTick?.price ?? row?.ltp ?? null
  const chg = row?.change_pct ?? null

  const isTradeWorkspace = activeWorkspace === 'trade'

  return (
    <>
      <header className="md:hidden h-12 shrink-0 border-b border-border/80 bg-bg-2/95 backdrop-blur-lg flex items-center justify-between px-3 z-30 select-none">
        {/* Left side: Watchlist trigger (if on Trade workspace) or Logo */}
        <div className="flex items-center gap-2">
          {isTradeWorkspace ? (
            <button
              onClick={onOpenWatchlist}
              className="w-8 h-8 flex items-center justify-center rounded-md bg-white/[0.03] border border-border hover:bg-white/[0.06] active:scale-95 transition-all text-text-dim hover:text-text"
              title="Open Watchlist"
            >
              <List className="w-4 h-4 text-info" />
            </button>
          ) : (
            <span className="font-mono text-xs font-black tracking-wider text-info">
              MAET
            </span>
          )}

          <div className="flex flex-col justify-center">
            {isTradeWorkspace ? (
              <>
                <span className="text-[11px] font-semibold text-text truncate max-w-[100px]">
                  {selectedSymbol?.replace('-EQ', '') ?? 'Select Symbol'}
                </span>
                {ltp != null && (
                  <span className={cn(
                    'text-[9px] font-mono leading-none',
                    chg != null && chg > 0 ? 'text-up' : chg != null && chg < 0 ? 'text-down' : 'text-text-faint'
                  )}>
                    {fmtPrice(ltp)} ({chg != null ? `${chg > 0 ? '+' : ''}${chg.toFixed(2)}%` : '—'})
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] font-bold text-text uppercase tracking-wider">
                {workspaceName}
              </span>
            )}
          </div>
        </div>

        {/* Center: System status dot or mini-stats */}
        <div className="flex items-center gap-1.5 bg-bg/50 border border-border px-2 py-0.5 rounded-full">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            wsConnected && apiStatus === 'ONLINE' ? 'bg-up animate-pulse-soft' : 'bg-warn'
          )} />
          <span className="text-[8px] font-mono text-text-faint leading-none tracking-tight">
            {istTime?.substring(0, 5) || '--:--'}
          </span>
        </div>

        {/* Right side: Intelligence/Order ticket trigger (if on Trade) or Mode Badge */}
        <div className="flex items-center gap-1.5">
          {isTradeWorkspace ? (
            <button
              onClick={onOpenRightPanel}
              className="h-8 px-2 flex items-center justify-center gap-1 rounded-md bg-info/10 border border-info/20 hover:bg-info/15 active:scale-95 transition-all text-info font-mono text-[9px] font-semibold"
              title="Trade & Intelligence"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>ORDER</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded border border-border bg-panel px-1.5 py-0.5 text-[8px] font-mono text-paper leading-none">
              <LockKeyhole className="h-2.5 w-2.5" />
              <span>{executionMode === 'PAPER' ? 'PAPER' : 'LIVE'}</span>
            </div>
          )}
        </div>
      </header>
      <div className="md:hidden bg-panel/20 border-b border-border/40 py-1 px-3 flex justify-start items-center gap-1.5 overflow-x-auto scrollbar-none select-none shrink-0">
        <SafetyBadgeGroup size="xs" className="flex-nowrap" />
      </div>
    </>
  )
}
