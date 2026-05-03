'use client'

import { useEffect } from 'react'
import { TerminalLayout } from '@/components/terminal/terminal-layout'
import { MarketDataProvider } from '@/components/websocket/market-provider'
import { useTerminalStore } from '@/store/terminal-store'
import { fetchHealth, fetchIndices } from '@/lib/api'

function TerminalInitializer() {
  const { setIndices, setGatewayStatus, addLog } = useTerminalStore()

  useEffect(() => {
    // Fetch initial health status
    const loadInitialData = async () => {
      try {
        // Load health/status
        const health = await fetchHealth()
        if (health.broker) {
          setGatewayStatus(health.broker)
        }
        addLog(`Terminal initialized in ${health.mode} mode`, 'info')
      } catch {
        addLog('Backend API unavailable - running in offline mode', 'warning')
      }

      // Load indices (if endpoint exists)
      try {
        const indices = await fetchIndices()
        if (Array.isArray(indices)) {
          setIndices(indices)
        }
      } catch {
        // Indices endpoint may not exist yet
      }
    }

    loadInitialData()
  }, [setIndices, setGatewayStatus, addLog])

  return null
}

export default function TerminalPage() {
  return (
    <MarketDataProvider>
      <TerminalInitializer />
      <TerminalLayout />
    </MarketDataProvider>
  )
}
