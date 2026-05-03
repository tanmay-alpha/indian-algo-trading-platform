'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { WS_URL, WS_RECONNECT_DELAY, WS_MAX_RECONNECT_ATTEMPTS } from '@/lib/constants'
import type { TickData, GatewayStatus } from '@/lib/types'

interface WebSocketMessage {
  type: 'TICK' | 'GATEWAY_STATUS' | 'ERROR'
  // TICK data
  symbol?: string
  token?: string
  price?: number
  vwap?: number
  signal?: 'BUY' | 'SELL' | 'NEUTRAL'
  portfolio?: TickData['portfolio']
  mode?: 'PAPER' | 'LIVE'
  auto_pilot?: boolean
  // Gateway status
  status?: GatewayStatus
  // Error
  error?: string
}

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const {
    setConnected,
    setConnectionError,
    updateTick,
    setGatewayStatus,
    addLog,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    reconnectAttempts,
  } = useTerminalStore()

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setConnected(true)
        setConnectionError(null)
        resetReconnectAttempts()
        addLog('Real-time market stream established', 'success')
      }

      ws.onclose = (event) => {
        if (!mountedRef.current) return
        setConnected(false)
        
        if (!event.wasClean) {
          addLog('Connection lost, attempting to reconnect...', 'warning')
        }

        // Attempt to reconnect
        if (reconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(WS_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000)
          incrementReconnectAttempts()
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect()
            }
          }, delay)
        } else {
          setConnectionError('Max reconnection attempts reached. Please refresh the page.')
          addLog('Max reconnection attempts reached', 'error')
        }
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setConnectionError('WebSocket connection error')
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const data: WebSocketMessage = JSON.parse(event.data)

          switch (data.type) {
            case 'TICK':
              if (data.symbol && data.price !== undefined && data.portfolio) {
                const tickData: TickData = {
                  type: 'TICK',
                  symbol: data.symbol,
                  token: data.token || '',
                  price: data.price,
                  vwap: data.vwap,
                  signal: data.signal,
                  portfolio: data.portfolio,
                  mode: data.mode || 'PAPER',
                  auto_pilot: data.auto_pilot || false,
                  timestamp: Date.now(),
                }
                updateTick(tickData)
              }
              break

            case 'GATEWAY_STATUS':
              if (data.status) {
                setGatewayStatus(data.status)
              }
              break

            case 'ERROR':
              if (data.error) {
                addLog(`Server error: ${data.error}`, 'error')
              }
              break

            default:
              // Handle unknown message types gracefully
              break
          }
        } catch {
          // Silently ignore parse errors
        }
      }
    } catch {
      setConnectionError('Failed to create WebSocket connection')
    }
  }, [
    setConnected,
    setConnectionError,
    updateTick,
    setGatewayStatus,
    addLog,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    reconnectAttempts,
  ])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return <>{children}</>
}
