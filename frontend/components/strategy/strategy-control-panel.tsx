'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Play,
  Square,
  Pause,
  Zap,
  RefreshCw,
  Bot,
  Power,
  Clock,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StrategyConfigRuntime, StrategySchedulerStatus } from '@/lib/types'
import {
  getStrategyConfigs,
  getSchedulerStatus,
  startStrategy,
  stopStrategy,
  pauseStrategy,
  evaluateStrategy,
  startScheduler,
  stopScheduler,
} from '@/lib/api'
import { useTerminalStore } from '@/store/terminal-store'

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-up bg-up/10 border-up/30',
  PAUSED: 'text-warn bg-warn/10 border-warn/30',
  STOPPED: 'text-text-faint bg-panel border-border',
  ERROR: 'text-down bg-down/10 border-down/30',
}

const STATUS_DOT: Record<string, string> = {
  RUNNING: 'bg-up',
  PAUSED: 'bg-warn',
  STOPPED: 'bg-text-faint',
  ERROR: 'bg-down',
}

export function StrategyControlPanel() {
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const [configs, setConfigs] = useState<StrategyConfigRuntime[]>([])
  const [scheduler, setScheduler] = useState<StrategySchedulerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<number | string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfgs, sched] = await Promise.all([getStrategyConfigs(), getSchedulerStatus()])
      setConfigs(cfgs)
      setScheduler(sched)
      setLastRefreshed(Date.now())
    } catch {
      setError('Failed to load strategy data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const setActionState = (key: number | string, active: boolean) =>
    setActionLoading((prev) => ({ ...prev, [key]: active }))

  const handleStart = async (id: number) => {
    setActionState(id, true)
    await startStrategy(id, adminToken)
    await load()
    setActionState(id, false)
  }

  const handleStop = async (id: number) => {
    setActionState(id, true)
    await stopStrategy(id, adminToken)
    await load()
    setActionState(id, false)
  }

  const handlePause = async (id: number) => {
    setActionState(id, true)
    await pauseStrategy(id, adminToken)
    await load()
    setActionState(id, false)
  }

  const handleEvaluate = async (id: number) => {
    setActionState(`eval-${id}`, true)
    await evaluateStrategy(id, adminToken)
    await load()
    setActionState(`eval-${id}`, false)
  }

  const handleSchedulerToggle = async () => {
    setActionState('scheduler', true)
    if (scheduler?.running) {
      await stopScheduler(adminToken)
    } else {
      await startScheduler(adminToken)
    }
    const s = await getSchedulerStatus()
    setScheduler(s)
    setActionState('scheduler', false)
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 min-h-0 overflow-auto">
      {/* Scheduler Status Bar */}
      <div className="flex items-center justify-between rounded-sm border border-border bg-panel/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot className={cn('w-3.5 h-3.5', scheduler?.running ? 'text-up' : 'text-text-faint')} />
          <div>
            <div className="text-xs font-semibold text-text">Autopilot Scheduler</div>
            <div className="text-[10px] font-mono text-text-faint mt-0.5">
              {scheduler?.running
                ? `Tracking ${scheduler.strategies_tracked} strategies · ticks every ${scheduler.tick_interval_seconds}s`
                : 'Scheduler stopped — strategies evaluated manually only'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scheduler?.running ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-mono font-semibold text-up border-up/30 bg-up/10">
              <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse inline-block" />
              AUTOPILOT ON
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-mono text-text-faint border-border bg-panel">
              AUTOPILOT OFF
            </span>
          )}
          <button
            onClick={handleSchedulerToggle}
            disabled={!!actionLoading['scheduler']}
            className={cn(
              'h-7 px-3 rounded-sm border text-[10px] font-mono font-semibold transition-colors disabled:opacity-50',
              scheduler?.running
                ? 'text-down border-down/30 bg-down/10 hover:bg-down/20'
                : 'text-up border-up/30 bg-up/10 hover:bg-up/20'
            )}
          >
            <Power className="inline w-3 h-3 mr-1" />
            {actionLoading['scheduler'] ? '...' : scheduler?.running ? 'Stop Autopilot' : 'Start Autopilot'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="h-7 px-2 rounded-sm border border-border bg-bg text-[10px] font-mono text-text-dim hover:text-text disabled:opacity-40"
          >
            <RefreshCw className={cn('inline w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-sm border border-down/30 bg-down/10 px-3 py-2 text-[10px] font-mono text-down">
          {error}
        </div>
      )}

      {/* Strategy Cards */}
      {configs.length === 0 && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <Layers className="w-7 h-7 text-text-faint opacity-60" />
          <div className="text-xs font-mono text-text-faint">No strategy configurations found</div>
          <div className="text-[10px] text-text-faint opacity-70">
            Create a strategy config via API to manage it here
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {configs.map((cfg) => (
            <StrategyCard
              key={cfg.id}
              config={cfg}
              actionLoading={actionLoading}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              onEvaluate={handleEvaluate}
            />
          ))}
        </div>
      )}

      {/* Last refreshed footer */}
      {lastRefreshed && (
        <div className="text-[10px] font-mono text-text-faint opacity-60 text-right">
          <Clock className="inline w-2.5 h-2.5 mr-1" />
          Last refreshed {new Date(lastRefreshed).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

function StrategyCard({
  config,
  actionLoading,
  onStart,
  onStop,
  onPause,
  onEvaluate,
}: {
  config: StrategyConfigRuntime
  actionLoading: Record<number | string, boolean>
  onStart: (id: number) => void
  onStop: (id: number) => void
  onPause: (id: number) => void
  onEvaluate: (id: number) => void
}) {
  const isRunning = config.status === 'RUNNING'
  const isPaused = config.status === 'PAUSED'
  const isStopped = config.status === 'STOPPED'
  const loading = !!actionLoading[config.id]
  const evalLoading = !!actionLoading[`eval-${config.id}`]

  return (
    <div className={cn(
      'rounded-sm border bg-panel/50 overflow-hidden',
      isRunning ? 'border-up/20' : isPaused ? 'border-warn/20' : 'border-border'
    )}>
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-bg/40">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[config.status] ?? 'bg-text-faint', isRunning && 'animate-pulse')} />
          <div>
            <div className="text-xs font-semibold text-text">{config.name}</div>
            <div className="text-[10px] font-mono text-text-faint mt-0.5">
              {config.template_id} · {config.timeframe} · {config.mode}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-1.5 py-0.5 rounded-sm border text-[10px] font-mono font-semibold', STATUS_COLOR[config.status] ?? STATUS_COLOR.STOPPED)}>
            {config.status}
          </span>
          {config.auto_paper_enabled && (
            <span className="px-1.5 py-0.5 rounded-sm border border-info/30 bg-info/10 text-info text-[10px] font-mono">
              AUTO
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 py-2 grid grid-cols-3 gap-3 text-[10px] font-mono">
        <MiniStat label="Symbols" value={config.symbols.join(', ') || '—'} />
        <MiniStat label="Eval Interval" value={`${config.evaluation_interval_seconds}s`} />
        <MiniStat label="Cooldown" value={`${config.cooldown_seconds}s`} />
        <MiniStat
          label="Last Eval"
          value={config.last_evaluated_at
            ? new Date(config.last_evaluated_at).toLocaleTimeString()
            : 'Never'}
        />
        <MiniStat
          label="Next Eval"
          value={config.next_evaluation_at
            ? new Date(config.next_evaluation_at).toLocaleTimeString()
            : '—'}
        />
        <MiniStat label="Max Signals/Day" value={String(config.max_signals_per_day)} />
      </div>

      {/* Card actions */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {isStopped && (
          <ActionButton
            icon={<Play className="w-3 h-3" />}
            label="Start"
            className="text-up border-up/30 bg-up/10 hover:bg-up/20"
            loading={loading}
            onClick={() => onStart(config.id)}
          />
        )}
        {isRunning && (
          <>
            <ActionButton
              icon={<Pause className="w-3 h-3" />}
              label="Pause"
              className="text-warn border-warn/30 bg-warn/10 hover:bg-warn/20"
              loading={loading}
              onClick={() => onPause(config.id)}
            />
            <ActionButton
              icon={<Square className="w-3 h-3" />}
              label="Stop"
              className="text-down border-down/30 bg-down/10 hover:bg-down/20"
              loading={loading}
              onClick={() => onStop(config.id)}
            />
          </>
        )}
        {isPaused && (
          <>
            <ActionButton
              icon={<Play className="w-3 h-3" />}
              label="Resume"
              className="text-up border-up/30 bg-up/10 hover:bg-up/20"
              loading={loading}
              onClick={() => onStart(config.id)}
            />
            <ActionButton
              icon={<Square className="w-3 h-3" />}
              label="Stop"
              className="text-down border-down/30 bg-down/10 hover:bg-down/20"
              loading={loading}
              onClick={() => onStop(config.id)}
            />
          </>
        )}
        {(isRunning || isPaused) && (
          <ActionButton
            icon={<Zap className="w-3 h-3" />}
            label="Eval Now"
            className="text-info border-info/30 bg-info/10 hover:bg-info/20"
            loading={evalLoading}
            onClick={() => onEvaluate(config.id)}
          />
        )}
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  className,
  loading,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  className: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2 rounded-sm border text-[10px] font-mono font-medium transition-colors disabled:opacity-50',
        className
      )}
    >
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : icon}
      {label}
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-faint">{label}</div>
      <div className="text-[10px] font-mono text-text truncate" title={value}>{value || '—'}</div>
    </div>
  )
}
