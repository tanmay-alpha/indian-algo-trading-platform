'use client'

import { useEffect, useState } from 'react'
import {
  getManualOrderTickets,
  getPortfolioHoldings,
  getPortfolioPositions,
} from '@/lib/api'
import { useTerminalStore } from '@/store/terminal-store'

type TabId = 'positions' | 'orders' | 'holdings'

interface RowData {
  id: string
  left: string
  mid: string
  right: string
}

const tabs: { id: TabId; label: string; empty: string }[] = [
  { id: 'positions', label: 'Positions', empty: 'No Positions data' },
  { id: 'orders', label: 'Order Book', empty: 'No Order Book data' },
  { id: 'holdings', label: 'Holdings', empty: 'No Holdings data' },
]

export function BottomTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('positions')
  const [rows, setRows] = useState<RowData[]>([])
  const [loading, setLoading] = useState(false)
  const adminToken = useTerminalStore((state) => state.omsAdminToken)

  useEffect(() => {
    let mounted = true
    if (!adminToken) {
      setRows([])
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    const token = adminToken
    setLoading(true)

    async function load() {
      const nextRows = await loadRows(activeTab, token)
      if (!mounted) return
      setRows(nextRows)
      setLoading(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [activeTab, adminToken])

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  return (
    <section className="flex h-[200px] shrink-0 flex-col border-t border-border bg-panel">
      <div className="flex h-8 shrink-0 items-center border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'h-8 px-4 font-mono text-[11px] transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-accent text-text-primary'
                : 'text-text-muted hover:text-text-primary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 animate-pulse rounded bg-surface" />
            <div className="h-8 animate-pulse rounded bg-surface" />
            <div className="h-8 animate-pulse rounded bg-surface" />
          </div>
        ) : rows.length > 0 ? (
          <div className="space-y-1">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid h-8 grid-cols-[1fr_120px_120px] items-center gap-3 border border-border bg-base px-3 font-mono text-[10px]"
              >
                <span className="truncate text-text-primary">{row.left}</span>
                <span className="truncate text-right text-text-muted">{row.mid}</span>
                <span className="truncate text-right text-text-primary">{row.right}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-[11px] text-text-hint">{active.empty}</span>
          </div>
        )}
      </div>
    </section>
  )
}

async function loadRows(tab: TabId, adminToken: string): Promise<RowData[]> {
  try {
    if (tab === 'positions') {
      const positions = await getPortfolioPositions(adminToken)
      return positions.map((position) => ({
        id: position.symbol,
        left: position.symbol,
        mid: `${position.quantity.toLocaleString('en-IN')} qty`,
        right: formatMaybeNumber(position.net_pnl ?? position.gross_pnl ?? position.unrealized_pnl),
      }))
    }

    if (tab === 'holdings') {
      const holdings = await getPortfolioHoldings(adminToken)
      return holdings.map((holding) => ({
        id: holding.symbol,
        left: holding.symbol,
        mid: `${holding.quantity.toLocaleString('en-IN')} qty`,
        right: formatMaybeNumber(holding.pnl),
      }))
    }

    const result = await getManualOrderTickets(adminToken, 50)
    if (!result.ok) return []
    return result.data.map((order) => ({
      id: order.ticket_id,
      left: `${order.side} ${order.symbol}`,
      mid: `${order.quantity.toLocaleString('en-IN')} qty`,
      right: order.status,
    }))
  } catch {
    return []
  }
}

function formatMaybeNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '0.00'
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
