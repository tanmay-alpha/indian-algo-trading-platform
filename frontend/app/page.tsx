'use client'

import { useEffect } from 'react'
import { TerminalLayout } from '@/components/terminal/terminal-layout'
import { MarketDataProvider } from '@/components/websocket/market-provider'
import { useTerminalStore } from '@/store/terminal-store'
import { fetchHealth, fetchIndices, fetchMarketWatch, fetchTerminalStatus } from '@/lib/api'

function TerminalInitializer() {
  const {
    setIndices,
    setTerminalStatus,
    setBrokerStatus,
    setPortfolio,
    setMode,
    setBackendOffline,
    setStatusSource,
    ingestMarketWatchRows,
    ingestEvent,
    refreshPortfolio,
  } = useTerminalStore()

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const health = await fetchHealth()
        if (health.broker) {
          setBrokerStatus(health.broker)
        }
        if (health.portfolio) setPortfolio(health.portfolio)
        setMode(health.mode)
        setBackendOffline(false)
        ingestEvent({
          event_type: 'log',
          component: 'API',
          severity: 'info',
          message: `Terminal initialized in ${health.mode} mode`,
        })
      } catch {
        setBackendOffline(true)
        ingestEvent({
          event_type: 'log',
          component: 'API',
          severity: 'warning',
          message: 'Backend API unavailable - running in offline mode',
        })
      }

      try {
        const status = await fetchTerminalStatus()
        setTerminalStatus(status)
        if (useTerminalStore.getState().wsStatus !== 'CONNECTED') {
          setStatusSource('REST')
        }
      } catch {
        // Status can be unavailable while the backend is booting.
      }

      try {
        const watch = await fetchMarketWatch()
        ingestMarketWatchRows(watch.items || [])
      } catch {
        // Market watch can remain empty without fabricating prices.
      }

      try {
        const indices = await fetchIndices()
        setIndices(indices)
      } catch {
        // Indices endpoint can be unavailable; UI shows empty values.
      }

      await refreshPortfolio()
    }

    loadInitialData()
  }, [
    ingestEvent,
    ingestMarketWatchRows,
    refreshPortfolio,
    setBackendOffline,
    setBrokerStatus,
    setIndices,
    setMode,
    setPortfolio,
    setStatusSource,
    setTerminalStatus,
  ])

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
