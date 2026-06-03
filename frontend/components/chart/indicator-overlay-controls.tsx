import type {
  ChartOverlayState,
  IndicatorEngineStatus,
  IndicatorOverlayName,
  IndicatorSubpanelName,
  IndicatorSubpanelState,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const OVERLAY_BUTTONS: Array<{ label: string; name: IndicatorOverlayName }> = [
  { label: 'EMA', name: 'ema' },
  { label: 'VWAP', name: 'vwap' },
  { label: 'BB', name: 'bollinger_bands' },
]

const SUBPANEL_BUTTONS: Array<{ label: string; name: IndicatorSubpanelName }> = [
  { label: 'RSI', name: 'rsi' },
  { label: 'MACD', name: 'macd' },
]

export function IndicatorOverlayControls({
  overlays,
  subpanels,
  status,
  loading,
  noCandles,
  error,
  onToggleOverlay,
  onToggleSubpanel,
}: {
  overlays: ChartOverlayState
  subpanels: IndicatorSubpanelState
  status: IndicatorEngineStatus | null
  loading: boolean
  noCandles: boolean
  error: string | null
  onToggleOverlay: (name: IndicatorOverlayName) => void
  onToggleSubpanel: (name: IndicatorSubpanelName) => void
}) {
  const engineLabel = status?.selected_engine
    ? status.selected_engine === 'cpp'
      ? 'C++'
      : 'Python fallback'
    : 'Unavailable'

  return (
    <div className="absolute left-4 top-20 z-20 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {OVERLAY_BUTTONS.map((button) => (
          <button
            key={button.name}
            onClick={() => onToggleOverlay(button.name)}
            className={indicatorButtonClass(overlays[button.name])}
          >
            {button.label}
          </button>
        ))}
        {SUBPANEL_BUTTONS.map((button) => (
          <button
            key={button.name}
            onClick={() => onToggleSubpanel(button.name)}
            className={indicatorButtonClass(subpanels[button.name])}
          >
            {button.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="rounded border border-border bg-panel/70 px-2 py-1 text-text-faint">
          Engine <span className="text-text-2">{engineLabel}</span>
        </span>
        {loading && (
          <span className="rounded border border-info/25 bg-info-dim px-2 py-1 text-info">
            Loading indicators
          </span>
        )}
        {noCandles && (
          <span className="rounded border border-warn/25 bg-warn-dim px-2 py-1 text-warn">
            No candle data available
          </span>
        )}
        {error && (
          <span className="rounded border border-down/25 bg-down-dim px-2 py-1 text-down">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

function indicatorButtonClass(active: boolean): string {
  return cn(
    'h-6 px-2 rounded border text-xs font-mono transition-colors',
    active
      ? 'border-info/40 bg-info-dim text-info'
      : 'border-border bg-panel/70 text-text-dim hover:text-text'
  )
}
