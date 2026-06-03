import { Terminal, ShieldCheck } from 'lucide-react'

const rows = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY']

export function TerminalPreview() {
  return (
    <div className="glass-card-3d overflow-hidden rounded-lg border border-[#38bdf8]/15 text-left font-mono shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-white/[0.04] bg-bg-2/50 px-3 text-xs text-text-dim">
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-[#38bdf8]" />
          <span>VISUAL DEMO PREVIEW</span>
        </div>
        <span>DEMO</span>
      </div>

      <div className="divide-y divide-white/[0.03] bg-[#05070a]/80 p-3">
        {rows.map((symbol) => (
          <div key={symbol} className="flex items-center justify-between py-1.5 text-xs">
            <span className="font-semibold text-white">{symbol}</span>
            <div className="flex gap-4">
              <span className="tabular-nums text-text-2">--</span>
              <span className="w-14 text-right tabular-nums text-text-faint">demo</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.04] bg-white/[0.01] px-3 py-2 text-xs text-text-dim">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-[#38bdf8]" />
          SECURE SANDBOX
        </span>
        <span>NOT LIVE DATA</span>
      </div>
    </div>
  )
}
