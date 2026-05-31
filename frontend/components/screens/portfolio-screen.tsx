'use client'

import { useState } from 'react'
import {
  LockKeyhole, Eye, EyeOff, RefreshCw, ShieldCheck,
  TrendingUp, TrendingDown, RefreshCw as ResetIcon
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { PremiumCard, MetricCard } from '@/components/maet/premium-card'

export function PortfolioScreen() {
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const setOmsAdminToken = useTerminalStore((s) => s.setOmsAdminToken)
  const clearOmsAdminToken = useTerminalStore((s) => s.clearOmsAdminToken)
  const fetchManualOrderTickets = useTerminalStore((s) => s.fetchManualOrderTickets)
  const refreshPortfolio = useTerminalStore((s) => s.refreshPortfolio)

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

  const quality = summary?.data_status === 'AVAILABLE' ? 'LIVE' : error ? 'OFFLINE' : 'UNAVAILABLE'

  const formatRupee = (val: number | null | undefined) => {
    if (val == null) return '₹0.00'
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (!adminToken) {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-8">
        <div className="w-full max-w-sm mx-auto rounded-3xl border border-border/80 bg-bg-surface p-6 shadow-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#38bdf8]/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-center text-amber-500 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <LockKeyhole className="h-6 w-6 animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-2 mb-6">
            <h3 className="text-md font-bold text-text">Developer Unlock</h3>
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
                className="maet-input pr-10 font-mono text-sm"
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
              <div className="text-xs text-down font-mono text-center bg-down/8 border border-down/15 py-2 px-3 rounded-xl">
                {unlockError}
              </div>
            )}

            <button
              type="button"
              onClick={handleUnlock}
              disabled={isUnlocking || !tokenInput.trim()}
              className="w-full h-11 rounded-xl bg-info text-bg text-sm font-semibold hover:bg-info/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              {isUnlocking && <RefreshCw className="h-4 w-4 animate-spin" />}
              Verify &amp; Unlock
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-border/60">
            <div className="flex items-center gap-2 text-info font-semibold uppercase tracking-wider text-[10px] mb-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Hardened Environment Policy</span>
            </div>
            <ul className="text-[11px] text-text-faint space-y-1.5 list-disc pl-4 font-mono">
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
    <div className="flex flex-col h-full">
      {/* Portfolio Header stats */}
      <div className="px-4 pt-3 pb-2 shrink-0 flex items-center justify-between">
        <div>
          <div className="text-xs text-text-faint uppercase font-bold tracking-wider">Net Portfolio Value</div>
          <div className="text-2xl font-bold tabular-nums text-text mt-0.5">
            {formatRupee(summary?.equity)}
          </div>
        </div>
        <button
          onClick={() => refreshPortfolio()}
          disabled={loading}
          className="w-9 h-9 rounded-xl border border-border/80 bg-bg-card flex items-center justify-center text-text-dim active:scale-95 transition-all"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Main scrolling cards list */}
      <div className="flex-1 overflow-y-auto px-4 pb-nav space-y-4">
        {/* Realized / Unrealized Quick summary */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Realized P&amp;L"
            value={formatRupee(summary?.realized_pnl)}
            trend={(summary?.realized_pnl ?? 0) > 0 ? 'up' : (summary?.realized_pnl ?? 0) < 0 ? 'down' : 'neutral'}
          />
          <MetricCard
            label="Unrealized P&amp;L"
            value={formatRupee(summary?.unrealized_pnl)}
            trend={(summary?.unrealized_pnl ?? 0) > 0 ? 'up' : (summary?.unrealized_pnl ?? 0) < 0 ? 'down' : 'neutral'}
          />
        </div>

        {/* Positions Section */}
        <div>
          <div className="section-label mb-2">Open Positions ({positions.length})</div>
          {positions.length === 0 ? (
            <EmptyPortfolioState title="No positions" sub="Verify dry-run order to create simulated positions." />
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
          <div className="section-label mb-2">Broker Holdings ({holdings.length})</div>
          {holdings.length === 0 ? (
            <EmptyPortfolioState title="No holdings connected" sub="Broker holdings sync has not returned data." />
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
          <div className="rounded-2xl border border-warn/20 bg-warn/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warn animate-pulse" />
              <span className="text-xs font-semibold text-warn">Reconciliation Alert ({reconciliation.summary.mismatch_count})</span>
            </div>
            <div className="space-y-1.5">
              {[...(reconciliation.positions || []), ...(reconciliation.holdings || [])].map((m, idx) => (
                <div key={idx} className="text-2xs font-mono text-text-dim flex justify-between">
                  <span>{m.symbol} · {m.field}</span>
                  <span className="text-warn">{m.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PositionRow({ pos }: { pos: any }) {
  const isUp = (pos.unrealized_pnl ?? 0) > 0
  const cleanSym = pos.symbol.split(':').pop()?.split('-')[0] ?? pos.symbol

  return (
    <div className="p-3.5 rounded-2xl border border-border/60 bg-bg-card flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-text leading-tight">{cleanSym}</div>
        <div className="text-2xs text-text-faint font-mono leading-tight mt-0.5">
          {pos.quantity} Qty · Avg ₹{pos.avg_price?.toFixed(2)}
        </div>
      </div>
      <div className="text-right">
        <div className={cn('text-sm font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
          {isUp ? '+' : ''}₹{pos.unrealized_pnl?.toFixed(2)}
        </div>
        <div className="text-2xs text-text-faint mt-0.5">Unrealized P&amp;L</div>
      </div>
    </div>
  )
}

function HoldingRow({ hold }: { hold: any }) {
  const isUp = (hold.pnl ?? 0) > 0
  const cleanSym = hold.symbol.split(':').pop()?.split('-')[0] ?? hold.symbol

  return (
    <div className="p-3.5 rounded-2xl border border-border/60 bg-bg-card flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-text leading-tight">{cleanSym}</div>
        <div className="text-2xs text-text-faint font-mono leading-tight mt-0.5">
          {hold.quantity} Qty · Avg ₹{hold.average_price?.toFixed(2)}
        </div>
      </div>
      <div className="text-right">
        <div className={cn('text-sm font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
          {isUp ? '+' : ''}₹{hold.pnl?.toFixed(2)}
        </div>
        <div className="text-2xs text-text-faint mt-0.5">Current ₹{hold.ltp?.toFixed(2)}</div>
      </div>
    </div>
  )
}

function EmptyPortfolioState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="py-8 text-center rounded-2xl border border-dashed border-border/50">
      <div className="text-xs font-semibold text-text-2">{title}</div>
      <div className="text-2xs text-text-faint mt-1 max-w-[200px] mx-auto leading-relaxed">{sub}</div>
    </div>
  )
}
