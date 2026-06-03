'use client'

import { useEffect, useState } from 'react'
import { Bot, Eye, EyeOff, History, Info, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { useToast } from '@/components/ui-maet/toast'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, fmtPrice } from '@/lib/utils'
import type { ManualOrderTicket } from '@/lib/types'

type Side = 'BUY' | 'SELL'
type OrderKind = 'MARKET' | 'LIMIT' | 'SL'

export function OrderTicket({ compact = false }: { compact?: boolean }) {
  const { pushToast } = useToast()
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const selectedExchange = useTerminalStore((s) => s.selectedExchange)
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const setOmsAdminToken = useTerminalStore((s) => s.setOmsAdminToken)
  const clearOmsAdminToken = useTerminalStore((s) => s.clearOmsAdminToken)
  const fetchManualOrderTickets = useTerminalStore((s) => s.fetchManualOrderTickets)
  const fetchManualOrderStatus = useTerminalStore((s) => s.fetchManualOrderStatus)
  const validateOrder = useTerminalStore((s) => s.validateManualOrder)

  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [symbol, setSymbol] = useState(selectedSymbol ?? '')
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>((selectedExchange as 'NSE' | 'BSE' | null) ?? 'NSE')
  const [side, setSide] = useState<Side>('BUY')
  const [quantity, setQuantity] = useState(1)
  const [orderType, setOrderType] = useState<OrderKind>('MARKET')
  const [price, setPrice] = useState('')
  const [trigger, setTrigger] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [ticket, setTicket] = useState<ManualOrderTicket | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedSymbol) setSymbol(selectedSymbol)
    if (selectedExchange === 'NSE' || selectedExchange === 'BSE') setExchange(selectedExchange)
  }, [selectedExchange, selectedSymbol])

  const cleanSymbol = symbol.split(':').pop()?.replace(/-EQ$/, '') ?? symbol

  const handleUnlock = async () => {
    if (!tokenInput.trim()) return
    setIsUnlocking(true)
    setUnlockError(null)
    setOmsAdminToken(tokenInput.trim())
    const result = await fetchManualOrderTickets()
    setIsUnlocking(false)
    if (!result.ok) {
      clearOmsAdminToken()
      if ('adminRequired' in result && result.adminRequired) setUnlockError('Invalid administrator token.')
      else if ('backendUnavailable' in result && result.backendUnavailable) setUnlockError('Validation backend is offline.')
      else setUnlockError(('error' in result && result.error) || 'Could not unlock validation.')
      return
    }
    setTokenInput('')
    void fetchManualOrderStatus()
    pushToast({ type: 'info', title: 'Validation unlocked', body: 'Admin token is held in memory for dry-run checks.' })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalizedSymbol = symbol.trim().toUpperCase()
    if (!normalizedSymbol) {
      setError('Symbol is required.')
      return
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero.')
      return
    }
    if (orderType !== 'MARKET' && !price.trim()) {
      setError('Price is required for LIMIT and SL validation.')
      return
    }
    if (!acknowledged) {
      setError('Confirm dry-run safety before validation.')
      return
    }

    setError(null)
    setTicket(null)
    setIsValidating(true)
    const result = await validateOrder({
      symbol: normalizedSymbol,
      exchange,
      side,
      quantity,
      product_type: 'CNC',
      order_type: orderType,
      price_override: orderType === 'MARKET' ? null : Number(price),
    })
    setIsValidating(false)

    if (result.ok && result.ticket) {
      setTicket(result.ticket)
      pushToast({ type: 'success', title: 'Validation passed', body: `${normalizedSymbol} dry-run ticket returned by risk gate.` })
      void fetchManualOrderTickets()
    } else {
      const message = result.error ?? 'Validation failed.'
      setError(message)
      pushToast({ type: 'error', title: 'Validation failed', body: message })
    }
  }

  if (!adminToken) {
    return (
      <div className={cn('reflection-card flex flex-col bg-maet-overlay/105', compact ? 'p-3' : 'h-full p-4')}>
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-maet-amber/30 bg-maet-amber/10 text-maet-amber">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-bold text-maet-text">Dry-run validation</h2>
            <p className="mt-1 text-xs leading-5 text-maet-text-secondary">Protected endpoint. Enter the admin token to validate a simulation ticket.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleUnlock()
              }}
              placeholder="X-Admin-Token"
              autoComplete="off"
              className="maet-input pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken((current) => !current)}
              aria-label={showToken ? 'Hide admin token' : 'Show admin token'}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-maet-text-muted hover:bg-maet-elevated hover:text-maet-text"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {unlockError && <div className="rounded-md border border-maet-red/25 bg-maet-red/10 px-3 py-2 text-xs text-maet-red">{unlockError}</div>}
          <button
            type="button"
            onClick={handleUnlock}
            disabled={isUnlocking || !tokenInput.trim()}
            className="maet-btn maet-btn-primary h-11 w-full disabled:opacity-40"
          >
            {isUnlocking && <RefreshCw className="h-4 w-4 animate-spin" />}
            Unlock Validation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('reflection-card flex flex-col overflow-hidden bg-maet-overlay/105', compact ? '' : 'h-full')}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-maet-glass-border bg-maet-bg-deep/40 px-4 py-3">
        <div>
          <h2 className="font-heading text-base font-bold text-maet-text">Dry-Run Validation</h2>
          <StatusBadge tone="paper" className="mt-1">validation_only=true</StatusBadge>
        </div>
        <button
          type="button"
          onClick={clearOmsAdminToken}
          className="rounded-full border border-maet-glass-border bg-maet-glass-1 px-2.5 py-1.5 font-mono text-xs font-bold text-maet-text-secondary hover:bg-maet-glass-2 hover:text-maet-text"
        >
          Lock
        </button>
      </div>

      <form onSubmit={handleSubmit} className={cn('overflow-y-auto p-4', compact ? '' : 'min-h-0 flex-1')}>
        <div className="space-y-4">
          <Field label="Symbol">
            <input value={cleanSymbol} readOnly className="maet-input font-mono font-bold" />
          </Field>

          <Field label="Exchange">
            <select value={exchange} onChange={(event) => setExchange(event.target.value as 'NSE' | 'BSE')} className="maet-input font-mono">
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </Field>

          <div>
            <Label>Side</Label>
            <div className="grid grid-cols-2 gap-2">
              <Segment active={side === 'BUY'} tone="buy" onClick={() => setSide('BUY')}>BUY</Segment>
              <Segment active={side === 'SELL'} tone="sell" onClick={() => setSide('SELL')}>SELL</Segment>
            </div>
          </div>

          <Field label="Qty">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="maet-input font-mono"
            />
          </Field>

          <div>
            <Label>Order type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['MARKET', 'LIMIT', 'SL'] as OrderKind[]).map((item) => (
                <Segment key={item} active={orderType === item} onClick={() => setOrderType(item)}>{item}</Segment>
              ))}
            </div>
          </div>

          <Field label="Price">
            <input
              type="number"
              step="0.05"
              value={price}
              disabled={orderType === 'MARKET'}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={orderType === 'MARKET' ? 'Market price from backend' : 'Validation price'}
              className="maet-input font-mono disabled:opacity-45"
            />
          </Field>

          {orderType === 'SL' && (
            <Field label="Trigger">
              <input
                type="number"
                step="0.05"
                value={trigger}
                onChange={(event) => setTrigger(event.target.value)}
                placeholder="Trigger price"
                className="maet-input font-mono"
              />
            </Field>
          )}

          <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-maet-amber/30 bg-maet-amber/10 p-3 text-xs leading-5 text-maet-text-soft">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-maet-amber"
            />
            <span>
              I understand this validates a dry-run order only. live_execution_enabled=false and broker_mutation_allowed=false.
            </span>
          </label>

          {error && <div className="rounded-md border border-maet-red/25 bg-maet-red/10 px-3 py-2 text-xs text-maet-red">{error}</div>}

          <button
            type="submit"
            disabled={isValidating || !symbol.trim() || !acknowledged}
            className="maet-btn maet-btn-primary h-11 w-full disabled:opacity-40"
          >
            {isValidating && <RefreshCw className="h-4 w-4 animate-spin" />}
            Validate Dry-Run Order
          </button>
        </div>

        {ticket && (
          <div className="mt-4 rounded-card border border-maet-green/30 bg-maet-green/10 p-3">
            <div className="flex items-center gap-2 font-heading text-sm font-bold text-maet-green">
              <ShieldCheck className="h-4 w-4" />
              Validation passed
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
              <Result label="Ticket" value={ticket.ticket_id} />
              <Result label="Status" value={ticket.status} />
              <Result label="Notional" value={fmtPrice(ticket.estimated_notional)} />
              <Result label="Price" value={fmtPrice(ticket.price)} />
              <Result label="validation_only" value="true" />
              <Result label="live_execution_enabled" value="false" />
              <Result label="broker_mutation_allowed" value="false" />
            </div>
            <p className="mt-3 text-xs leading-5 text-maet-text-secondary">{ticket.validation_summary}</p>
          </div>
        )}
      </form>
    </div>
  )
}

export function ChartRightPanel() {
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const selectedExchange = useTerminalStore((s) => s.selectedExchange)
  const selectedInstrumentName = useTerminalStore((s) => s.selectedInstrumentName)
  const marketWatch = useTerminalStore((s) => s.marketWatch)
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const tickets = useTerminalStore((s) => s.manualOrderTickets)
  const manualOrderStatus = useTerminalStore((s) => s.manualOrderStatus)
  const fetchManualOrderTickets = useTerminalStore((s) => s.fetchManualOrderTickets)
  const fetchManualOrderStatus = useTerminalStore((s) => s.fetchManualOrderStatus)

  useEffect(() => {
    if (!adminToken) return
    void fetchManualOrderStatus()
    void fetchManualOrderTickets()
  }, [adminToken, fetchManualOrderStatus, fetchManualOrderTickets])

  const row = selectedSymbol ? marketWatch[selectedSymbol] : null
  const cleanSymbol = selectedSymbol?.split(':').pop()?.replace(/-EQ$/, '') ?? 'No symbol'
  const ltp = row?.ltp ?? null
  const changePct = row?.change_pct ?? null
  const recentTickets = tickets.slice(0, 3)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="maet-glass p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-maet-text-muted">Selected symbol</div>
            <div className="mt-1 truncate font-mono text-xl font-extrabold text-maet-text">{cleanSymbol}</div>
            <div className="mt-1 truncate text-sm text-maet-text-muted">{selectedInstrumentName ?? 'Choose from watchlist'}</div>
          </div>
          <span className="rounded-full border border-white/10 bg-maet-glass-bg px-2.5 py-1 text-xs font-bold text-maet-text-soft">
            {selectedExchange ?? row?.exchange ?? 'NSE'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <RightMetric label="LTP" value={formatRightPrice(ltp)} />
          <RightMetric
            label="Change"
            value={changePct == null ? '--' : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
            tone={changePct == null ? 'muted' : changePct >= 0 ? 'up' : 'down'}
          />
        </div>
      </div>

      <OrderTicket compact />

      <div className="maet-glass p-3">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-maet-amber" />
          <div className="font-heading text-sm font-bold text-maet-text">Safety checklist</div>
        </div>
        <div className="space-y-2">
          <SafetyCheck label="LIVE LOCKED" value="true" />
          <SafetyCheck label="PAPER MODE" value="true" />
          <SafetyCheck label="READ ONLY" value="broker context" />
          <SafetyCheck label="AI ADVISORY ONLY" value="true" />
          <SafetyCheck label="BROKER MUTATION DISABLED" value="true" />
          <SafetyCheck label="Creates broker order" value={manualOrderStatus?.creates_broker_order ? 'true' : 'false'} />
        </div>
      </div>

      <div className="maet-glass p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-maet-cyan" />
            <div className="font-heading text-sm font-bold text-maet-text">Recent dry-run history</div>
          </div>
          {!adminToken && <span className="text-xs font-bold text-maet-amber">Locked</span>}
        </div>
        {adminToken && recentTickets.length > 0 ? (
          <div className="space-y-2">
            {recentTickets.map((ticket) => (
              <div key={ticket.ticket_id} className="rounded-lg border border-white/10 bg-maet-ink-950/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-bold text-maet-text">{ticket.symbol}</span>
                  <span className="font-mono text-xs text-maet-text-muted">{ticket.status}</span>
                </div>
                <div className="mt-1 text-xs text-maet-text-muted">
                  {ticket.side} {ticket.quantity} / validation_only=true
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-maet-text-muted">
            {adminToken ? 'No validation tickets returned by the backend yet.' : 'Unlock validation to view protected dry-run tickets.'}
          </p>
        )}
      </div>

      <div className="maet-glass border-maet-blue/20 p-3">
        <div className="flex items-start gap-2 text-sm leading-6 text-maet-text-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-maet-blue-soft" />
          Broker account sync is read-only. Paper fills and dry-run tickets are not broker-confirmed trades.
        </div>
      </div>

      <div className="maet-glass border-maet-violet/25 bg-maet-violet/10 p-3">
        <div className="flex items-start gap-2 text-sm leading-6 text-maet-text-soft">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-maet-violet" />
          AI advisory can explain risk context, but execution_allowed=false.
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-bold text-maet-text-muted">{children}</label>
}

function Segment({
  active,
  children,
  onClick,
  tone,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  tone?: 'buy' | 'sell'
}) {
  const activeClass =
    tone === 'buy'
      ? 'border-maet-green bg-maet-green/20 text-maet-green'
      : tone === 'sell'
      ? 'border-maet-red bg-maet-red/20 text-maet-red'
      : 'border-maet-blue bg-maet-blue/20 text-maet-blue'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 rounded-md border font-mono text-xs font-bold transition-colors',
        active ? activeClass : 'border-maet-border bg-maet-surface text-maet-text-secondary hover:bg-maet-elevated hover:text-maet-text'
      )}
    >
      {children}
    </button>
  )
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-maet-border bg-maet-surface px-2 py-1.5">
      <div className="text-xs text-maet-text-muted">{label}</div>
      <div className="truncate font-bold text-maet-text">{value}</div>
    </div>
  )
}

function RightMetric({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'up' | 'down' | 'muted' }) {
  return (
    <div className="rounded-lg border border-white/10 bg-maet-ink-950/40 px-3 py-2">
      <div className="text-xs font-semibold text-maet-text-muted">{label}</div>
      <div className={cn('maet-number mt-1 font-mono text-sm font-extrabold', tone === 'up' ? 'text-maet-green' : tone === 'down' ? 'text-maet-red' : 'text-maet-text')}>
        {value}
      </div>
    </div>
  )
}

function SafetyCheck({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-maet-amber/20 bg-maet-amber/10 px-3 py-2">
      <span className="text-xs font-bold text-maet-amber">{label}</span>
      <span className="font-mono text-xs font-bold text-maet-text">{value}</span>
    </div>
  )
}

function formatRightPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
