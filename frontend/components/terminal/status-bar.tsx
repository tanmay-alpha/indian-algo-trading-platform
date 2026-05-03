'use client'

import { Clock, Wifi, Database, Cpu } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { formatTime, cn } from '@/lib/utils'

export function StatusBar() {
  const { isConnected, lastUpdate, executionMode, gatewayStatus, reconnectAttempts } = useTerminalStore()

  return (
    <footer className="h-7 px-4 flex items-center justify-between bg-[#0d1117] border-t border-border text-[10px]">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          <Wifi
            className={cn('w-3 h-3', isConnected ? 'text-success' : 'text-danger')}
          />
          <span className={cn(isConnected ? 'text-success' : 'text-danger')}>
            {isConnected ? 'LIVE' : reconnectAttempts > 0 ? `RECONNECTING (${reconnectAttempts})` : 'OFFLINE'}
          </span>
        </div>

        {/* Gateway Status */}
        {gatewayStatus && (
          <div className="flex items-center gap-1.5">
            <Database
              className={cn(
                'w-3 h-3',
                gatewayStatus.websocket_started ? 'text-success' : 'text-danger'
              )}
            />
            <span className="text-text-dim">
              Gateway: {gatewayStatus.websocket_started ? 'Active' : 'Inactive'}
            </span>
          </div>
        )}

        {/* Mode */}
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-accent" />
          <span className="text-text-dim">
            Mode: <span className="text-text-main font-medium">{executionMode}</span>
          </span>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Last Update */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-text-dim" />
          <span className="text-text-dim">
            Last Update:{' '}
            <span className="text-text-main font-mono">
              {lastUpdate ? formatTime(lastUpdate) : '--:--:--'}
            </span>
          </span>
        </div>

        {/* Version */}
        <span className="text-text-dim">v0.1.0</span>
      </div>
    </footer>
  )
}
