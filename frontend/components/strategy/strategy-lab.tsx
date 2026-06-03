'use client'

import { useEffect } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { StrategyTemplateCards } from './strategy-template-cards'
import { StrategyParameterPanel } from './strategy-parameter-panel'
import { BacktestControlPanel } from './backtest-control-panel'
import { BacktestMetricsGrid } from './backtest-metrics-grid'
import { BacktestEquityCurve } from './backtest-equity-curve'
import { BacktestTradesTable } from './backtest-trades-table'
import { StrategySignalFeed } from './strategy-signal-feed'
import { StrategyEmptyState } from './strategy-empty-state'

export function StrategyLab() {
  const status = useTerminalStore((s) => s.strategyStatus)
  const templates = useTerminalStore((s) => s.strategyTemplates)
  const selectedName = useTerminalStore((s) => s.selectedStrategyName)
  const params = useTerminalStore((s) => s.selectedStrategyParams)
  const config = useTerminalStore((s) => s.backtestConfig)
  const result = useTerminalStore((s) => s.backtestResult)
  const signals = useTerminalStore((s) => s.strategySignals)
  const loading = useTerminalStore((s) => s.strategyLoading)
  const error = useTerminalStore((s) => s.strategyError)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const fetchStatus = useTerminalStore((s) => s.fetchStrategyStatus)
  const fetchTemplates = useTerminalStore((s) => s.fetchStrategyTemplates)
  const selectStrategy = useTerminalStore((s) => s.selectStrategy)
  const updateStrategyParam = useTerminalStore((s) => s.updateStrategyParam)
  const updateBacktestConfig = useTerminalStore((s) => s.updateBacktestConfig)
  const runBacktest = useTerminalStore((s) => s.runSelectedStrategyBacktest)
  const previewSignals = useTerminalStore((s) => s.fetchSignalPreview)
  const clearResult = useTerminalStore((s) => s.clearBacktestResult)

  useEffect(() => {
    void fetchStatus()
    void fetchTemplates()
  }, [fetchStatus, fetchTemplates])

  const selectedTemplate = templates.find((template) => template.strategy_name === selectedName)

  return (
    <div className="h-full min-h-0 overflow-auto p-3 space-y-3">
      <div className="flex items-center justify-between rounded-sm border border-border bg-panel/60 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-text">Strategy Lab</div>
          <div className="text-xs font-mono text-text-faint">
            Offline research and backtesting only. No execution route is called.
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded border border-border bg-bg px-2 py-1 text-text-faint">
            Engine <span className="text-text">{status?.engine ?? 'python'}</span>
          </span>
          <span className="rounded border border-warn/25 bg-warn-dim px-2 py-1 text-warn">
            LIVE EXECUTION DISABLED
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-down/25 bg-down-dim px-3 py-2 text-xs font-mono text-down">
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <StrategyEmptyState
          title={status?.available === false ? 'Strategy backend unavailable' : 'No strategy templates loaded'}
          hint="The Strategy Lab will remain empty until the backend strategy API is reachable."
        />
      ) : (
        <StrategyTemplateCards templates={templates} selected={selectedName} onSelect={selectStrategy} />
      )}

      <div className="grid grid-cols-[minmax(300px,420px)_1fr] gap-3">
        <div className="space-y-3">
          <StrategyParameterPanel
            template={selectedTemplate}
            params={params}
            onChange={updateStrategyParam}
          />
          <BacktestControlPanel
            config={config}
            status={status}
            selectedSymbol={selectedSymbol}
            selectedStrategy={selectedName}
            loading={loading}
            onConfigChange={updateBacktestConfig}
            onRun={runBacktest}
            onPreview={previewSignals}
            onClear={clearResult}
          />
          <StrategySignalFeed signals={signals} />
        </div>
        <div className="space-y-3">
          <BacktestMetricsGrid result={result} />
          <BacktestEquityCurve points={result?.equity_curve || []} />
          <BacktestTradesTable trades={result?.trades || []} />
        </div>
      </div>
    </div>
  )
}
