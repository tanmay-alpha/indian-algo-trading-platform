'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
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
      <div className={cn('reflection-card flex h-full flex-col bg-maet-overlay/65', compact ? 'p-3' : 'p-4')}>
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
    <div className={cn('reflection-card flex h-full flex-col overflow-hidden bg-maet-overlay/65', compact ? '' : '')}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-maet-glass-border bg-maet-bg-deep/38 px-4 py-3">
        <div>
          <h2 className="font-heading text-base font-bold text-maet-text">Dry-Run Validation</h2>
          <StatusBadge tone="paper" className="mt-1">validation_only=true</StatusBadge>
        </div>
        <button
          type="button"
          onClick={clearOmsAdminToken}
          className="rounded-full border border-maet-glass-border bg-maet-glass-1 px-2.5 py-1.5 font-mono text-[11px] font-bold text-maet-text-secondary hover:bg-maet-glass-2 hover:text-maet-text"
        >
          Lock
        </button>
      </div>

      <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-4">
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
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
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
      ? 'border-maet-green bg-maet-green/15 text-maet-green'
      : tone === 'sell'
      ? 'border-maet-red bg-maet-red/15 text-maet-red'
      : 'border-maet-blue bg-maet-blue/15 text-maet-blue'

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
      <div className="text-[10px] text-maet-text-muted">{label}</div>
      <div className="truncate font-bold text-maet-text">{value}</div>
    </div>
  )
}
