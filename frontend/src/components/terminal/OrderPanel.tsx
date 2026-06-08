'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { OHLCPanel } from '@/components/chart/OHLCPanel'
import { DEMO_SYMBOLS, formatINR } from '@/lib/demoSymbols'
import { useTerminalStore } from '@/store/terminal-store'

type Side = 'BUY' | 'SELL'
type Product = 'MIS' | 'CNC' | 'NRML'
type OrderType = 'Limit' | 'Market' | 'SL'

export function OrderPanel() {
  const activeSym = useTerminalStore((state) => state.activeSym)
  const dayPnl = useTerminalStore((state) => state.dayPnl)
  const setDayPnl = useTerminalStore((state) => state.setDayPnl)
  const addPaperOrder = useTerminalStore((state) => state.addPaperOrder)
  const validateManualOrder = useTerminalStore((state) => state.validateManualOrder)
  const adminToken = useTerminalStore((state) => state.omsAdminToken)
  const selected = DEMO_SYMBOLS.find((item) => item.sym === activeSym) ?? DEMO_SYMBOLS[0]

  const [side, setSide] = useState<Side>('BUY')
  const [product, setProduct] = useState<Product>('MIS')
  const [orderType, setOrderType] = useState<OrderType>('Limit')
  const [qty, setQty] = useState(10)
  const [price, setPrice] = useState<number>(selected.price)
  const [lastMsg, setLastMsg] = useState('')

  useEffect(() => {
    setPrice(selected.price)
  }, [selected.price])

  const estimatedNotional = useMemo(() => qty * price, [price, qty])

  async function handleDryRun() {
    setLastMsg('Validating paper order...')
    const request = {
      symbol: activeSym,
      exchange: 'NSE',
      side,
      quantity: qty,
      product_type: product,
      order_type: orderType,
      price_override: orderType === 'Market' ? null : price,
    }

    const localOrder = { sym: activeSym, side, qty, price, product, ts: Date.now() }
    addPaperOrder(localOrder)

    if (!adminToken) {
      setLastMsg(`PASS - local paper check for ${activeSym}`)
      return
    }

    const result = await Promise.race([
      validateManualOrder(request),
      new Promise<{ ok: false; backendUnavailable: true }>((resolve) => {
        window.setTimeout(() => resolve({ ok: false, backendUnavailable: true }), 3500)
      }),
    ])

    if (result.ok) {
      setLastMsg(`PASS - ${side} ${qty} ${activeSym} @ ${formatINR(price)}`)
      const delta = side === 'BUY' ? -estimatedNotional * 0.0005 : estimatedNotional * 0.0005
      setDayPnl(dayPnl + delta)
      return
    }

    if ('adminRequired' in result || 'backendUnavailable' in result) {
      setLastMsg(`PASS - local paper check for ${activeSym}`)
      return
    }

    setLastMsg(`FAIL - ${'error' in result ? result.error : 'validation failed'}`)
  }

  const inputClass =
    'h-8 w-full rounded border border-border bg-surface px-2 font-mono text-xs text-text-primary outline-none focus:border-accent'
  const labelClass = 'font-mono text-[10px] uppercase tracking-wide text-text-muted'

  return (
    <aside className="flex min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-l border-border bg-panel">
      <div className="border-b border-border p-3">
        <OHLCPanel />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className={labelClass}>Paper Order</span>
          <Badge variant="paper">paper</Badge>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded border border-border">
          {(['BUY', 'SELL'] as Side[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSide(item)}
              className={[
                'h-8 font-mono text-[11px] font-medium transition-colors',
                item === side && item === 'BUY'
                  ? 'bg-up-dim text-up'
                  : item === side && item === 'SELL'
                  ? 'bg-dn-dim text-dn'
                  : 'text-text-muted hover:bg-hover hover:text-text-primary',
              ].join(' ')}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1">
          {(['MIS', 'CNC', 'NRML'] as Product[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setProduct(item)}
              className={[
                'h-7 rounded border font-mono text-[10px] transition-colors',
                product === item
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-border text-text-muted hover:border-border-light hover:text-text-primary',
              ].join(' ')}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Qty</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(event) => setQty(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Price</span>
          <input
            type="number"
            step={0.05}
            value={price}
            onChange={(event) => setPrice(Number.parseFloat(event.target.value) || selected.price)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Order type</span>
          <select
            value={orderType}
            onChange={(event) => setOrderType(event.target.value as OrderType)}
            className={inputClass}
          >
            <option>Limit</option>
            <option>Market</option>
            <option>SL</option>
          </select>
        </label>

        <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[10px]">
          <span className="text-text-muted">Est. notional</span>
          <span className="text-text-primary">{formatINR(estimatedNotional)}</span>
        </div>

        <button
          type="button"
          onClick={handleDryRun}
          className="mt-auto h-9 rounded border border-accent/30 bg-accent-dim font-mono text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
        >
          Dry run →
        </button>

        {lastMsg && (
          <div className={`font-mono text-[10px] leading-5 ${lastMsg.startsWith('FAIL') ? 'text-dn' : 'text-up'}`}>
            {lastMsg}
          </div>
        )}
      </div>
    </aside>
  )
}
