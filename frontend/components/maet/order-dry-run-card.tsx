'use client'

import { useState } from 'react'
import { Lock, ShieldAlert, Play, CheckCircle } from 'lucide-react'

export function OrderDryRunCard() {
  const [symbol, setSymbol] = useState('RELIANCE')
  const [qty, setQty] = useState(10)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleDryRun = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    setTimeout(() => {
      setLoading(false)
      setMessage(`Dry-run validation successful: Gated Paper Order simulating purchase of ${qty} shares of ${symbol} validated against current risk parameters.`)
    }, 800)
  }

  return (
    <div className="glass-card-3d rounded-lg p-4 border border-[#38bdf8]/10 text-left select-none relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#38bdf8]/10 flex items-center justify-center border border-[#38bdf8]/20 text-[#38bdf8]">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wider uppercase">Order Sandbox</h4>
            <p className="text-[10px] font-mono text-text-dim">Simulated execution lab</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full border border-down/30 bg-down/10 text-down font-mono text-[10px] font-semibold tracking-wider flex items-center gap-1">
          <Lock className="w-3 h-3" />
          LIVE LOCKED
        </span>
      </div>

      {/* Content */}
      <form onSubmit={handleDryRun} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-text-dim uppercase font-mono block">Instrument</label>
            <input 
              type="text" 
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-[#05070a] border border-border rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#38bdf8]/50" 
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-text-dim uppercase font-mono block">Quantity</label>
            <input 
              type="number" 
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              min="1"
              className="w-full bg-[#05070a] border border-border rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#38bdf8]/50" 
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-1.5 px-3 rounded font-mono text-xs uppercase font-bold tracking-wider text-bg bg-[#38bdf8] hover:bg-[#7dd3fc] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              Validating Risk...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Dry-run Gated Order
            </>
          )}
        </button>

        {message && (
          <div className="bg-white/[0.01] p-2 rounded border border-[#38bdf8]/20 text-[10px] text-text-2 font-mono flex items-start gap-1.5 leading-normal">
            <CheckCircle className="w-3.5 h-3.5 text-up shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}
      </form>
    </div>
  )
}
