'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { searchInstruments } from '@/lib/api'
import type { Instrument } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  onPick: (i: Instrument) => void
  className?: string
  placeholder?: string
  autoFocusKey?: number
}

export function InstrumentSearch({
  onPick,
  className,
  placeholder = 'Search NSE / BSE…',
  autoFocusKey,
}: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocusKey !== undefined) inputRef.current?.focus()
  }, [autoFocusKey])

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await searchInstruments(trimmed)
        if (!cancelled) setResults(r.slice(0, 12))
      } catch {
        if (!cancelled) {
          setResults([])
          setError('Search unavailable — backend offline')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            const nextQuery = e.target.value
            setQ(nextQuery)
            setResults([])
            setError(null)
            setLoading(nextQuery.trim().length >= 2)
          }}
          placeholder={placeholder}
          className="w-full h-7 pl-7 pr-7 bg-panel border border-border rounded-sm text-xs font-mono placeholder:text-text-dim focus:border-info/40 focus:outline-none"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-dim hover:text-text"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(loading || results.length > 0 || error) && q.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-panel-2 border border-border-strong rounded-sm shadow-modal max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 h-7 flex items-center text-2xs font-mono text-text-dim">
              SEARCHING…
            </div>
          )}
          {error && !loading && (
            <div className="px-3 h-7 flex items-center text-2xs font-mono text-down">
              {error}
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="px-3 h-7 flex items-center text-2xs font-mono text-text-dim">
              NO MATCHES
            </div>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={`${r.token}-${r.symbol}`}
                onClick={() => {
                  onPick(r)
                  setQ('')
                  setResults([])
                }}
                className="w-full px-2.5 h-9 flex items-center gap-2 hover:bg-white/[0.04] text-left border-b border-border/40 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-text truncate">
                    {r.symbol}
                    <span className="text-text-faint ml-1.5">{r.exchange}</span>
                  </div>
                  <div className="text-xs text-text-dim truncate">{r.name}</div>
                </div>
                <Plus className="w-3.5 h-3.5 text-info shrink-0" />
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
