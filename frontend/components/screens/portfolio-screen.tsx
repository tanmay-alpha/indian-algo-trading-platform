'use client'

import { useState } from 'react'
import {
  LockKeyhole, Eye, EyeOff, RefreshCw, ShieldCheck,
  AlertTriangle, Briefcase, TrendingUp
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { PremiumCard } from '@/components/ui-maet/premium-card'
import { MetricCard } from '@/components/ui-maet/metric-card'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { EmptyState } from '@/components/ui-maet/empty-state'
import { MobilePage } from '@/components/mobile/mobile-page'
import { API_URL } from '@/lib/constants'

export function PortfolioScreen() {
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const setOmsAdminToken = useTerminalStore((s) => s.setOmsAdminToken)
  const clearOmsAdminToken = useTerminalStore((s) => s.clearOmsAdminToken)
  const refreshPortfolio = useTerminalStore((s) => s.refreshPortfolio)

  // Connection info for diagnostics
  const backendReachable = useTerminalStore((s) => s.backendReachable)
  const connectionError = useTerminalStore((s) => s.connectionError)
  const lastStatusError = useTerminalStore((s) => s.lastStatusError)

  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  const handleUnlock = async () => {
    if (!tokenInput.trim()) return
    setIsUnlocking(true)
    setUnlockError(null)
    try {
      setOmsAdminToken(tokenInput.trim())
      const res = await useTerminalStore.getState().fetchManualOrderTickets()
      if (res.ok) {
        setTokenInput('')
        setTimeout(() => {
          void useTerminalStore.getState().refreshPortfolio()
        }, 50)
      } else {
        clearOmsAdminToken()
        if ('adminRequired' in res && res.adminRequired) {
          setUnlockError('Invalid administrator token')
        } else if ('backendUnavailable' in res && res.backendUnavailable) {
          setUnlockError('Validation backend offline')
        } else {
          setUnlockError(('error' in res && res.error) || 'Failed to authenticate')
        }
      }
    } catch (err) {
      clearOmsAdminToken()
      setUnlockError(String(err))
    } finally {
      setIsUnlocking(false)
    }
  }

  const summary = useTerminalStore((s) => s.portfolioSummary)
  const positions = useTerminalStore((s) => s.positions)
  const holdings = useTerminalStore((s) => s.holdings)
  const reconciliation = useTerminalStore((s) => s.reconciliationStatus)
  const loading = useTerminalStore((s) => s.portfolioLoading)
  const error = useTerminalStore((s) => s.portfolioError)

  const formatRupee = (val: number | null | undefined) => {
    if (val == null) return '₹0.00'
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (!adminToken) {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-sm mx-auto rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#22D3EE]/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-center text-[#F59E0B] mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center">
              <LockKeyhole className="h-6 w-6 animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-2 mb-6">
            <h3 className="text-md font-bold text-text uppercase tracking-wider">Developer Unlock Required</h3>
            <p className="text-xs text-text-dim leading-relaxed">
              Protected portfolio endpoints require an Admin Token. Enter the token configured in your backend service.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleUnlock()
                }}
                placeholder="Enter admin token…"
                autoComplete="off"
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 pr-10 text-sm font-mono text-text placeholder-text-faint focus:outline-none focus:border-[#22D3EE]/50 focus:ring-1 focus:ring-[#22D3EE]/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
              >
                {showToken ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>

            {unlockError && (
              <div className="text-xs text-[#EA3943] font-mono text-center bg-[#EA3943]/10 border border-[#EA3943]/20 py-2.5 px-3 rounded-xl">
                {unlockError}
              </div>
            )}

            <button
              type="button"
              onClick={handleUnlock}
              disabled={isUnlocking || !tokenInput.trim()}
              className="w-full h-11 rounded-xl bg-[#22D3EE] text-[#070A0F] text-xs font-bold uppercase tracking-wider hover:bg-[#22D3EE]/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              {isUnlocking && <RefreshCw className="h-4 w-4 animate-spin" />}
              Verify &amp; Unlock
            </button>
          </div>

          {/* Connection Diagnostics (rendered when offline or when last fetch failed) */}
          {(!backendReachable || connectionError || lastStatusError) && (
            <div className="mt-4 p-3 rounded-2xl bg-[#EA3943]/5 border border-[#EA3943]/15 space-y-1.5 text-[10px] font-mono text-text-dim">
              <div className="flex items-center justify-between border-b border-white/[0.03] pb-1 mb-1">
                <span className="font-bold text-text text-[9px] uppercase">Connectivity Diagnostics</span>
                <span className={cn(
                  "px-1.5 py-0.25 rounded text-[8px] font-bold tracking-wider",
                  backendReachable ? "bg-[#16C784]/20 text-[#16C784]" : "bg-[#EA3943]/20 text-[#EA3943]"
                )}>
                  {backendReachable ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Target API:</span>
                <span className="text-text truncate max-w-[160px]">{API_URL || 'Not Configured'}</span>
              </div>
              {connectionError && (
                <div className="border-t border-white/[0.03] pt-1 mt-1">
                  <span className="font-semibold text-text text-[9px] block">Connection Error:</span>
                  <span className="text-[#EA3943] text-[9px] break-all">{connectionError}</span>
                </div>
              )}
              {lastStatusError && !connectionError && (
                <div className="border-t border-white/[0.03] pt-1 mt-1">
                  <span className="font-semibold text-text text-[9px] block">Last Health Error:</span>
                  <span className="text-[#EA3943] text-[9px] break-all">{lastStatusError}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-[#22D3EE] font-bold uppercase tracking-wider text-[10px] mb-3">
              <ShieldCheck className="h-4 w-4" />
              <span>Hardened Environment Policy</span>
            </div>
            <ul className="text-[11px] text-text-faint space-y-1.5 list-disc pl-4 font-mono font-medium">
              <li>All database queries are read-only</li>
              <li>Order validation is dry-run only</li>
              <li>No real exchange mutations</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Active / Unlocked state
  return (
    <MobilePage className="flex flex-col h-full pb-4 space-y-4">
      {/* Portfolio Header stats */}
      <div className="shrink-0 flex items-center justify-between bg-white/[0.015] border border-white/[0.04] p-4 rounded-2xl">
        <div>
          <div className="text-[10px] text-text-faint uppercase font-bold tracking-wider">Net Portfolio Value</div>
          <div className="text-2xl font-bold font-mono tracking-tight text-text mt-1">
            {formatRupee(summary?.equity)}
          </div>
        </div>
        <button
          onClick={() => refreshPortfolio()}
          disabled={loading}
          className="w-10 h-10 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-text-dim hover:text-text active:scale-95 transition-all"
        >
          <RefreshCw className={cn('w-4.5 h-4.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Realized / Unrealized Quick summary */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <MetricCard
          title="Realized P&amp;L"
          value={formatRupee(summary?.realized_pnl)}
          change={summary?.realized_pnl ? (summary.realized_pnl / (summary.equity || 1)) * 100 : 0}
          changeLabel="Equity"
        />
        <MetricCard
          title="Unrealized P&amp;L"
          value={formatRupee(summary?.unrealized_pnl)}
          change={summary?.unrealized_pnl ? (summary.unrealized_pnl / (summary.equity || 1)) * 100 : 0}
          changeLabel="Equity"
        />
      </div>

      {/* Main scrolling cards list */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-0.5">
        {/* Positions Section */}
        <div>
          <SectionTitle title={`Open Positions (${positions.length})`} />
          {positions.length === 0 ? (
            <EmptyState
              title="No Positions Found"
              hint="Submit order ticket validation requests to instantiate paper positions."
              icon={<Briefcase className="w-5 h-5 text-text-faint" />}
              compact
            />
          ) : (
            <div className="space-y-2">
              {positions.map((pos, idx) => (
                <PositionRow key={`${pos.symbol}-${idx}`} pos={pos} />
              ))}
            </div>
          )}
        </div>

        {/* Holdings Section */}
        <div>
          <SectionTitle title={`Broker Holdings (${holdings.length})`} />
          {holdings.length === 0 ? (
            <EmptyState
              title="No Holdings Synced"
              hint="Broker snapshot is currently empty or offline."
              icon={<Briefcase className="w-5 h-5 text-text-faint" />}
              compact
            />
          ) : (
            <div className="space-y-2">
              {holdings.map((hold, idx) => (
                <HoldingRow key={`${hold.symbol}-${idx}`} hold={hold} />
              ))}
            </div>
          )}
        </div>

        {/* Reconciliation mismatches */}
        {reconciliation && reconciliation.summary.mismatch_count > 0 && (
          <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider">
                Reconciliation Alert ({reconciliation.summary.mismatch_count})
              </span>
            </div>
            <div className="space-y-2 border-t border-white/[0.04] pt-2">
              {[...(reconciliation.positions || []), ...(reconciliation.holdings || [])].map((m, idx) => (
                <div key={idx} className="text-[10px] font-mono text-text-dim flex justify-between items-start gap-4">
                  <span className="font-semibold text-text">{m.symbol} · {m.field}</span>
                  <span className="text-[#F59E0B] text-right font-medium">{m.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MobilePage>
  )
}

function PositionRow({ pos }: { pos: any }) {
  const isUp = (pos.unrealized_pnl ?? 0) > 0
  const cleanSym = pos.symbol.split(':').pop()?.split('-')[0] ?? pos.symbol

  return (
    <div className="p-3.5 rounded-2xl border border-white/[0.04] bg-white/[0.015] flex items-center justify-between hover:bg-white/[0.035] transition-all">
      <div>
        <div className="text-xs font-bold text-text leading-tight tracking-wide">{cleanSym}</div>
        <div className="text-[10px] text-text-faint font-mono font-medium mt-1">
          {pos.quantity} Qty · Avg ₹{pos.avg_price?.toFixed(2)}
        </div>
      </div>
      <div className="text-right">
        <div className={cn('text-xs font-bold font-mono tracking-tight', isUp ? 'text-[#16C784]' : 'text-[#EA3943]')}>
          {isUp ? '+' : ''}₹{pos.unrealized_pnl?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[9px] text-text-faint font-semibold uppercase tracking-wider mt-1">Unrealized P&amp;L</div>
      </div>
    </div>
  )
}

function HoldingRow({ hold }: { hold: any }) {
  const isUp = (hold.pnl ?? 0) > 0
  const cleanSym = hold.symbol.split(':').pop()?.split('-')[0] ?? hold.symbol

  return (
    <div className="p-3.5 rounded-2xl border border-white/[0.04] bg-white/[0.015] flex items-center justify-between hover:bg-white/[0.035] transition-all">
      <div>
        <div className="text-xs font-bold text-text leading-tight tracking-wide">{cleanSym}</div>
        <div className="text-[10px] text-text-faint font-mono font-medium mt-1">
          {hold.quantity} Qty · Avg ₹{hold.average_price?.toFixed(2)}
        </div>
      </div>
      <div className="text-right">
        <div className={cn('text-xs font-bold font-mono tracking-tight', isUp ? 'text-[#16C784]' : 'text-[#EA3943]')}>
          {isUp ? '+' : ''}₹{hold.pnl?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[9px] text-text-faint font-semibold uppercase tracking-wider mt-1">LTP ₹{hold.ltp?.toFixed(2)}</div>
      </div>
    </div>
  )
}
