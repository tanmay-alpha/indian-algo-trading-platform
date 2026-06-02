'use client'

import { useState, useEffect } from 'react'
import { Terminal, ShieldCheck } from 'lucide-react'

export function TerminalPreview() {
  const [ticks, setTicks] = useState<{ symbol: string; price: number; change: number }[]>([
    { symbol: 'RELIANCE', price: 2840.40, change: 1.25 },
    { symbol: 'TCS', price: 3820.10, change: -0.45 },
    { symbol: 'HDFCBANK', price: 1610.85, change: 0.80 },
    { symbol: 'INFY', price: 1540.20, change: -1.10 }
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setTicks((prev) => 
        prev.map((tick) => {
          const delta = (Math.random() - 0.5) * 4
          const nextPrice = tick.price + delta
          const changeDelta = (delta / tick.price) * 100
          return {
            ...tick,
            price: nextPrice,
            change: tick.change + changeDelta
          }
        })
      )
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-card-3d rounded-lg border border-[#38bdf8]/15 overflow-hidden text-left font-mono select-none shadow-xl">
      {/* Title bar */}
      <div className="h-7 px-3 bg-bg-2/50 border-b border-white/[0.04] flex items-center justify-between text-[10px] text-text-dim">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-[#38bdf8]" />
          <span>VISUAL DEMO PREVIEW</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
          <span>DEMO</span>
        </div>
      </div>

      {/* Grid Content */}
      <div className="p-3 bg-[#05070a]/80 divide-y divide-white/[0.03]">
        {ticks.map((tick) => (
          <div key={tick.symbol} className="py-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-white">{tick.symbol}</span>
            <div className="flex gap-4">
              <span className="tabular-nums text-text-2">{tick.price.toFixed(2)}</span>
              <span className={`w-14 text-right tabular-nums ${tick.change >= 0 ? 'text-up' : 'text-down'}`}>
                {tick.change >= 0 ? '+' : ''}{tick.change.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Status Footer */}
      <div className="bg-white/[0.01] px-3 py-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-text-dim">
        <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8]" /> SECURE SANDBOX</span>
        <span>NOT LIVE DATA</span>
      </div>
    </div>
  )
}
