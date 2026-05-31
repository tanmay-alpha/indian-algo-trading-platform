'use client'

import { useState, useEffect } from 'react'
import {
  LockKeyhole,
  ShieldCheck,
  ShoppingCart,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  Unlock,
  RefreshCw,
  Info,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { fmtPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ManualOrderTicket } from '@/lib/types'

export function OrderTicket() {
  const tick = useTerminalStore((s) => s.currentTick)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  
  // Store actions and state
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const setOmsAdminToken = useTerminalStore((s) => s.setOmsAdminToken)
  const clearOmsAdminToken = useTerminalStore((s) => s.clearOmsAdminToken)
  const validateOrder = useTerminalStore((s) => s.validateManualOrder)
  const fetchManualOrderTickets = useTerminalStore((s) => s.fetchManualOrderTickets)
  const manualOrderTickets = useTerminalStore((s) => s.manualOrderTickets)

  // Token input gate state
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Order form state
  const [symbolInput, setSymbolInput] = useState('')
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState<number>(1)
  const [productType, setProductType] = useState<string>('CNC')
  const [orderType, setOrderType] = useState<string>('MARKET')
  const [priceOverride, setPriceOverride] = useState<string>('')

  // Validation execution state
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ManualOrderTicket | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Dry-run confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<{
    symbol: string; exchange: 'NSE' | 'BSE'; side: 'BUY' | 'SELL'
    quantity: number; productType: string; orderType: string; priceOverride: string | null
  } | null>(null)

  // Auto-fill symbol when selectedSymbol changes
  useEffect(() => {
    if (selectedSymbol) {
      setSymbolInput(selectedSymbol)
    } else if (tick?.symbol) {
      setSymbolInput(tick.symbol)
    }
  }, [selectedSymbol, tick])

  // Load ticket logs history when admin token is available
  useEffect(() => {
    if (adminToken) {
      void fetchManualOrderTickets()
    }
  }, [adminToken, fetchManualOrderTickets])

  const handleUnlock = async () => {
    if (!tokenInput.trim()) return
    setIsUnlocking(true)
    setUnlockError(null)
    try {
      // Set the token first
      setOmsAdminToken(tokenInput.trim())
      // Fetch manual order history to verify token
      const result = await useTerminalStore.getState().fetchManualOrderTickets()
      if (result && !result.ok) {
        if ('adminRequired' in result && result.adminRequired) {
          setUnlockError('Invalid administrator token.')
        } else if ('error' in result) {
          setUnlockError(result.error)
        } else {
          setUnlockError('Verification failed.')
        }
        clearOmsAdminToken()
      }
    } catch (err) {
      setUnlockError('Invalid token or connection error.')
      clearOmsAdminToken()
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!symbolInput.trim()) {
      setValidationError('Symbol is required')
      return
    }
    if (quantity <= 0) {
      setValidationError('Quantity must be greater than 0')
      return
    }
    // Show the dry-run confirmation modal before submitting
    setValidationError(null)
    setValidationResult(null)
    setPendingOrder({
      symbol: symbolInput.trim().toUpperCase(),
      exchange,
      side,
      quantity,
      productType,
      orderType,
      priceOverride: priceOverride || null,
    })
    setConfirmChecked(false)
    setShowConfirmModal(true)
  }

  const handleConfirmValidate = async () => {
    if (!confirmChecked || !pendingOrder) return
    setShowConfirmModal(false)
    setIsValidating(true)

    const requestBody = {
      symbol: pendingOrder.symbol,
      exchange: pendingOrder.exchange,
      side: pendingOrder.side,
      quantity: pendingOrder.quantity,
      product_type: pendingOrder.productType,
      order_type: pendingOrder.orderType,
      price_override: pendingOrder.priceOverride ? parseFloat(pendingOrder.priceOverride) : null,
    }

    const result = await validateOrder(requestBody)
    setIsValidating(false)

    if (result.ok && result.ticket) {
      setValidationResult(result.ticket)
      void fetchManualOrderTickets()
    } else {
      setValidationError(result.error ?? 'Validation request failed.')
    }
  }

  const populateFromHistory = (ticket: ManualOrderTicket) => {
    setSymbolInput(ticket.symbol)
    setExchange(ticket.exchange as 'NSE' | 'BSE')
    setSide(ticket.side as 'BUY' | 'SELL')
    setQuantity(ticket.quantity)
    setProductType(ticket.product_type)
    setOrderType(ticket.order_type)
    setPriceOverride(ticket.price_is_override && ticket.price != null ? String(ticket.price) : '')
    
    // Clear previous results when reloading a historical template
    setValidationResult(ticket)
    setValidationError(null)
  }

  return (
    <div className="flex h-full flex-col bg-bg-2/50 backdrop-blur-md">
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b border-[#38bdf8]/10 bg-panel/40 px-3 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-3.5 w-3.5 text-info" />
          <div>
            <div className="text-[11px] font-semibold text-text uppercase tracking-wider">Manual Order Ticket</div>
            <div className="text-[8px] text-text-faint font-mono">DRY-RUN RISK GATE VALIDATION</div>
          </div>
        </div>
        {adminToken && (
          <button
            onClick={clearOmsAdminToken}
            className="text-[9px] font-mono px-2 py-0.5 rounded border border-border text-text-dim hover:text-rose-400 hover:border-rose-500/30 transition-colors"
          >
            Lock Engine
          </button>
        )}
      </div>

      {/* Main Scrollable View */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        
        {/* State 1: Admin Token Required */}
        {!adminToken ? (
          <div className="space-y-4 py-4 animate-in fade-in duration-200">
            <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4 text-center space-y-3">
              <div className="flex justify-center text-amber-500">
                <LockKeyhole className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-tight text-amber-400">
                  Developer admin unlock
                </h4>
                <p className="text-[10px] text-text-faint font-mono leading-relaxed">
                  Required to view protected local/demo portfolio endpoints and unlock OMS manual order risk gates. Do not enter production secrets in public deployments.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleUnlock()
                    }}
                    placeholder="X-Admin-Token value"
                    autoComplete="off"
                    className="w-full h-8 rounded border border-[#38bdf8]/15 bg-bg/50 px-3 pr-9 text-xs font-mono text-text focus:outline-none focus:border-info/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {unlockError && (
                  <p className="text-[9px] text-rose-400 font-mono text-left">{unlockError}</p>
                )}

                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={isUnlocking || !tokenInput.trim()}
                  className="w-full h-8 rounded bg-info/20 border border-info/30 text-info text-xs font-mono font-bold hover:bg-info/30 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                >
                  {isUnlocking && <RefreshCw className="h-3 w-3 animate-spin" />}
                  Unlock Validation Engine
                </button>
              </div>
            </div>

            {/* Permanent Safety Warnings */}
            <div className="border border-border/40 bg-white/[0.01] rounded p-3 space-y-2 text-[10px] text-text-faint font-mono">
              <div className="flex items-center gap-1.5 text-amber-500 font-bold uppercase tracking-wider text-[9px]">
                <ShieldCheck className="h-3 w-3" />
                <span>Execution Lock Parameters</span>
              </div>
              <ul className="list-disc pl-4 space-y-1">
                <li>manual order validate is dry-run validation only.</li>
                <li>backend/core/live_build_policy.py is locked (False).</li>
                <li>No database mutations or live exchange routes allowed.</li>
              </ul>
            </div>
          </div>
        ) : (
          /* State 2: Interactive Form */
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Form */}
            <form onSubmit={handleValidate} className="space-y-3">
              {/* Buy/Sell Side Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={cn(
                    'h-9 rounded font-mono font-bold uppercase text-[11px] transition-all border',
                    side === 'BUY'
                      ? 'border-up bg-up/10 text-up shadow-[0_0_8px_rgba(34,197,94,0.15)]'
                      : 'border-border bg-bg/20 text-text-dim hover:text-text'
                  )}
                >
                  Buy Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={cn(
                    'h-9 rounded font-mono font-bold uppercase text-[11px] transition-all border',
                    side === 'SELL'
                      ? 'border-down bg-down/10 text-down shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                      : 'border-border bg-bg/20 text-text-dim hover:text-text'
                  )}
                >
                  Sell Ticket
                </button>
              </div>

              {/* Symbol & Exchange */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[8px] font-mono text-text-faint uppercase tracking-wider mb-1">Symbol</label>
                  <input
                    type="text"
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                    placeholder="e.g. INFY"
                    className="w-full h-8 rounded border border-border bg-bg/40 px-2 text-xs font-mono text-text focus:outline-none focus:border-info/50"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-mono text-text-faint uppercase tracking-wider mb-1">Exchange</label>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value as 'NSE' | 'BSE')}
                    className="w-full h-8 rounded border border-border bg-bg/40 px-1 text-xs font-mono text-text focus:outline-none focus:border-info/50"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>
              </div>

              {/* Quantity & Product Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-mono text-text-faint uppercase tracking-wider mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-8 rounded border border-border bg-bg/40 px-2 text-xs font-mono text-text focus:outline-none focus:border-info/50"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-mono text-text-faint uppercase tracking-wider mb-1">Product Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full h-8 rounded border border-border bg-bg/40 px-1.5 text-xs font-mono text-text focus:outline-none focus:border-info/50"
                  >
                    <option value="CNC">CNC (Cash & Carry)</option>
                    <option value="MIS">MIS (Intraday)</option>
                    <option value="NRML">NRML (Normal)</option>
                  </select>
                </div>
              </div>

              {/* Order Type & Price Override */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-mono text-text-faint uppercase tracking-wider mb-1">Order Type</label>
                  <select
                    value={orderType}
                    onChange={(e) => {
                      setOrderType(e.target.value)
                      if (e.target.value === 'MARKET') setPriceOverride('')
                    }}
                    className="w-full h-8 rounded border border-border bg-bg/40 px-1.5 text-xs font-mono text-text focus:outline-none focus:border-info/50"
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                    <option value="SL">SL (Stop-Loss)</option>
                    <option value="SL-M">SL-M (Stop-Loss Market)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-mono text-text-faint uppercase tracking-wider mb-1">
                    Price {orderType === 'MARKET' ? '(LTP Used)' : 'Override'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    disabled={orderType === 'MARKET'}
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder={tick?.ltp ? String(tick.ltp) : 'Price'}
                    className="w-full h-8 rounded border border-border bg-bg/40 px-2 text-xs font-mono text-text focus:outline-none focus:border-info/50 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Submit Validation Button */}
              <button
                type="submit"
                disabled={isValidating}
                className="w-full h-9 rounded bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 border border-[#38bdf8]/35 text-info text-xs font-mono font-bold tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Validating Risk Gates...
                  </>
                ) : (
                  'Validate Dry-Run Order'
                )}
              </button>
            </form>

            {/* Validation Rejection / Error banner */}
            {validationError && (
              <div className="rounded border border-rose-500/20 bg-rose-500/5 p-2.5 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-tight text-rose-400">
                    Request / Risk Gate Rejection
                  </div>
                  <p className="text-[10px] text-text-dim font-mono leading-tight">
                    {validationError}
                  </p>
                </div>
              </div>
            )}

            {/* Validation Result Diagnostic Report */}
            {validationResult && (
              <div className={cn(
                "rounded border p-3 space-y-3 glass-panel animate-in fade-in slide-in-from-top-1 duration-200",
                validationResult.status === 'VALIDATED' && validationResult.rejection_reason === null
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-rose-500/30 bg-rose-500/5"
              )}>
                {/* Result Header */}
                <div className="flex items-center justify-between border-b border-border/20 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    {validationResult.status === 'VALIDATED' && validationResult.rejection_reason === null ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400" />
                    )}
                    <span className="text-[11px] font-bold font-mono text-text">
                      {validationResult.symbol} · {validationResult.side}
                    </span>
                  </div>
                  <span className={cn(
                    "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold border",
                    validationResult.status === 'VALIDATED' && validationResult.rejection_reason === null
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      : "text-rose-400 border-rose-500/30 bg-rose-500/10"
                  )}>
                    {validationResult.status === 'VALIDATED' && validationResult.rejection_reason === null ? 'Validated' : 'Rejected'}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-y-2.5 text-[10px] font-mono">
                  <div>
                    <span className="text-text-faint block text-[8px] uppercase tracking-wide">Notional Exposure</span>
                    <span className="text-text font-bold">₹{fmtPrice(validationResult.estimated_notional)}</span>
                  </div>
                  <div>
                    <span className="text-text-faint block text-[8px] uppercase tracking-wide">Validation Price</span>
                    <span className="text-text">₹{fmtPrice(validationResult.price)} <span className="text-[7px] text-text-faint">({validationResult.price_source})</span></span>
                  </div>
                  <div>
                    <span className="text-text-faint block text-[8px] uppercase tracking-wide">Risk Engine Status</span>
                    <span className={validationResult.status === 'VALIDATED' ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {validationResult.status === 'VALIDATED' ? "PASSED" : "REJECTED"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-faint block text-[8px] uppercase tracking-wide">Timestamp</span>
                    <span className="text-text-dim text-[9px]">
                      {new Date(validationResult.created_at).toLocaleTimeString('en-IN', { hour12: false })}
                    </span>
                  </div>
                </div>

                {/* Rejection Details if applicable */}
                {validationResult.rejection_reason && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded p-2 text-[9px] font-mono text-rose-400">
                    <span className="font-bold uppercase block mb-0.5">Rejection Reason:</span>
                    {validationResult.rejection_reason}
                  </div>
                )}

                {/* Safety markers footer */}
                <div className="pt-2 border-t border-border/20 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded border border-amber-500/20">
                      DRY RUN ONLY
                    </span>
                    <span className="text-[8px] font-mono bg-cyan-500/10 text-cyan-400 px-1 py-0.5 rounded border border-cyan-500/20">
                      VALIDATION-ONLY
                    </span>
                    <span className="text-[8px] font-mono bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded border border-rose-500/20">
                      MUTATIONS LOCKED
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Log History */}
            {manualOrderTickets.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-text-dim border-b border-border/30 pb-1 shrink-0">
                  <History className="h-3.5 w-3.5 text-info" />
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
                    Recent Validation Logs ({manualOrderTickets.length})
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
                  {manualOrderTickets.slice(0, 10).map((ticket) => {
                    const isValid = ticket.status === 'VALIDATED' && ticket.rejection_reason === null
                    return (
                      <div
                        key={ticket.ticket_id}
                        onClick={() => populateFromHistory(ticket)}
                        className={cn(
                          "p-2 rounded border bg-bg/30 text-[10px] font-mono hover:bg-bg-2 cursor-pointer transition-colors border-l-3 flex flex-col gap-1",
                          isValid ? "border-l-emerald-500 border-border" : "border-l-rose-500 border-border"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("font-bold", ticket.side === 'BUY' ? 'text-up' : 'text-down')}>
                            {ticket.side} {ticket.symbol}
                          </span>
                          <span className="text-[8px] text-text-faint">
                            {new Date(ticket.created_at).toLocaleTimeString('en-IN', { hour12: false })}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] text-text-dim">
                          <span>Qty: {ticket.quantity} @ ₹{fmtPrice(ticket.price)}</span>
                          <span className={isValid ? "text-emerald-400 font-bold" : "text-rose-400"}>
                            {isValid ? "PASSED" : "REJ"}
                          </span>
                        </div>
                        {ticket.rejection_reason && (
                          <div className="text-[8px] text-rose-400/80 truncate">
                            Reason: {ticket.rejection_reason}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ── Dry-Run Confirmation Modal ─────────────────────────────── */}
      {showConfirmModal && pendingOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Dry-run confirmation">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          />
          {/* Modal card */}
          <div className="relative w-full max-w-sm rounded-lg border border-amber-500/30 bg-[#0c1117] shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Modal header */}
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 bg-amber-500/5">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">Dry-Run Confirmation</div>
                <div className="text-[9px] font-mono text-text-faint">VALIDATE ONLY — No broker order will be placed</div>
              </div>
            </div>

            {/* Order summary */}
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-faint block">Symbol</span>
                  <span className="text-text font-semibold">{pendingOrder.symbol}</span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-faint block">Side</span>
                  <span className={cn('font-bold', pendingOrder.side === 'BUY' ? 'text-up' : 'text-down')}>
                    {pendingOrder.side} (DRY-RUN)
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-faint block">Quantity</span>
                  <span className="text-text">{pendingOrder.quantity.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-faint block">Exchange</span>
                  <span className="text-text">{pendingOrder.exchange}</span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-faint block">Product Type</span>
                  <span className="text-text">{pendingOrder.productType}</span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-text-faint block">Order Type</span>
                  <span className="text-text">{pendingOrder.orderType}</span>
                </div>
                {pendingOrder.priceOverride && (
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-text-faint block">Price Override</span>
                    <span className="text-text">₹{parseFloat(pendingOrder.priceOverride).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {/* Safety state row */}
              <div className="rounded border border-border/50 bg-bg/60 px-2 py-1.5 flex flex-wrap gap-1.5">
                <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/25">DRY-RUN ONLY</span>
                <span className="text-[8px] font-mono bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/25">LIVE EXECUTION LOCKED</span>
                <span className="text-[8px] font-mono bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/25">BROKER MUTATION DISABLED</span>
              </div>

              {/* Safety disclaimer */}
              <p className="text-[9px] font-mono text-text-faint leading-relaxed">
                This will <strong className="text-text">not</strong> place a real broker order.
                The backend will validate risk gates and return a simulation ticket only.
              </p>

              {/* Required acknowledgement checkbox */}
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-400 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-text-2 group-hover:text-text transition-colors leading-snug">
                  I understand this is a <strong className="text-amber-400">dry-run validation only</strong>. No real order will be placed.
                </span>
              </label>
            </div>

            {/* Modal actions */}
            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-8 rounded border border-border bg-bg/40 text-[11px] font-mono text-text-dim hover:text-text hover:bg-bg-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmValidate}
                disabled={!confirmChecked}
                className="flex-1 h-8 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-mono font-bold hover:bg-amber-500/20 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Validate Dry-Run Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
