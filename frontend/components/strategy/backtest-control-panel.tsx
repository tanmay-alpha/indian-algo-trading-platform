import type { StrategyConfig, StrategyStatus } from '@/lib/types'

export function BacktestControlPanel({
  config,
  status,
  selectedSymbol,
  selectedStrategy,
  loading,
  onConfigChange,
  onRun,
  onPreview,
  onClear,
}: {
  config: StrategyConfig
  status: StrategyStatus | null
  selectedSymbol: string | null
  selectedStrategy: string | null
  loading: boolean
  onConfigChange: (patch: Partial<StrategyConfig>) => void
  onRun: () => void
  onPreview: () => void
  onClear: () => void
}) {
  const disabled = loading || !selectedStrategy || !selectedSymbol || status?.available === false
  return (
    <section className="rounded-sm border border-border bg-panel/60">
      <div className="border-b border-border bg-bg/60 px-3 py-2">
        <div className="text-xs font-semibold text-text">Backtest Controls</div>
        <div className="text-xs font-mono text-text-faint">
          Research only - does not place orders
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 p-3">
        <NumberInput label="Capital" value={config.initial_capital} onChange={(value) => onConfigChange({ initial_capital: value })} />
        <NumberInput label="Qty" value={config.quantity} onChange={(value) => onConfigChange({ quantity: value })} />
        <NumberInput label="Fee bps" value={config.fee_bps} onChange={(value) => onConfigChange({ fee_bps: value })} />
        <NumberInput label="Slippage bps" value={config.slippage_bps} onChange={(value) => onConfigChange({ slippage_bps: value })} />
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div className="font-mono text-xs text-text-faint">
          Symbol: <span className="text-text">{selectedSymbol || 'Select symbol'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="h-7 rounded-sm border border-border bg-bg px-2 text-xs font-mono text-text-dim hover:text-text">
            Clear
          </button>
          <button onClick={onPreview} disabled={disabled} className="h-7 rounded-sm border border-border bg-bg px-2 text-xs font-mono text-text-dim hover:text-text disabled:opacity-40">
            Preview Signals
          </button>
          <button onClick={onRun} disabled={disabled} className="h-7 rounded-sm border border-info/40 bg-info-dim px-3 text-xs font-mono text-info disabled:opacity-40">
            {loading ? 'Running' : 'Run Backtest'}
          </button>
        </div>
      </div>
    </section>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-mono uppercase text-text-faint">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 w-full rounded-sm border border-border bg-bg px-2 font-mono text-xs text-text outline-none focus:border-info/50"
      />
    </label>
  )
}

