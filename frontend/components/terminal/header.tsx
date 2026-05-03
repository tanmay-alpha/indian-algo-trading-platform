'use client'

import { Activity, Wifi, WifiOff, Zap } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'

export function Header() {
  const { isConnected, currentTick, executionMode, autoPilot } = useTerminalStore()

  return (
    <header className="h-14 px-6 flex items-center justify-between glass border-b border-border z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          <span className="font-semibold text-lg tracking-tight">
            MAET <span className="text-accent">Terminal</span>
          </span>
        </div>
      </div>

      {/* Center - Symbol Display */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-text-dim">Symbol:</span>
          <span className="font-mono font-semibold">
            {currentTick?.symbol || '---'}
          </span>
        </div>
      </div>

      {/* Right Side - Status */}
      <div className="flex items-center gap-4 text-sm">
        {/* Auto-Pilot Badge */}
        {autoPilot && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success border border-success/20">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">AUTO-PILOT</span>
          </div>
        )}

        {/* Mode Badge */}
        <div
          className={cn(
            'px-2.5 py-1 rounded text-xs font-semibold uppercase border',
            executionMode === 'LIVE'
              ? 'bg-danger/10 text-danger border-danger/20'
              : 'bg-accent/10 text-accent border-accent/20'
          )}
        >
          {executionMode}
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <Wifi className="w-4 h-4 text-success" />
              <span className="text-success text-xs font-medium">CONNECTED</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-danger" />
              <WifiOff className="w-4 h-4 text-danger" />
              <span className="text-danger text-xs font-medium">OFFLINE</span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
