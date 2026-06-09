'use client'

import { useEffect, useRef } from 'react'
import { WS_URL } from '@/lib/constants'
import { useTerminalStore } from '@/store/terminal-store'
import type { TickPayload, WsConnectionStatus } from '@/lib/types'

export type FrontendWsStatus = 'connected' | 'connecting' | 'degraded' | 'offline'

const CONNECT_TIMEOUT_MS = 4000
const RECONNECT_DELAYS_MS = [2000, 4000, 8000, 16_000, 30_000]
const MAX_MESSAGE_SIZE_BYTES = 1024 * 10 // 10KB max message size

export function useWebSocket() {
  const wsStatus = useTerminalStore((state) => state.wsStatus)
  const demo = useTerminalStore((state) => state.wsDemoMode)
  const reconnectInSeconds = useTerminalStore((state) => state.wsReconnectInSeconds)
  const attemptRef = useRef(0)
  const messageCountRef = useRef(0)

  useEffect(() => {
    let socket: WebSocket | null = null
    let mounted = true
    let connectTimer: number | null = null
    let reconnectTimer: number | null = null
    let countdownTimer: number | null = null
    let simulationTimer: number | null = null

    const setWsStatus = (status: WsConnectionStatus) => useTerminalStore.getState().setWsStatus(status)
    const setDemo = (value: boolean) => useTerminalStore.getState().setWsDemoMode(value)
    const setReconnect = (seconds: number | null) => useTerminalStore.getState().setWsReconnectInSeconds(seconds)
    const setConnectionError = (message: string | null) => useTerminalStore.getState().setConnectionError(message)
    const startSimulation = () => {
      if (simulationTimer) return
      simulationTimer = window.setInterval(() => {
        const state = useTerminalStore.getState()
        state.incTickCount()
        state.setDayPnl(state.dayPnl + (Math.random() - 0.48) * 18)
      }, 1200)
    }
    const stopSimulation = () => {
      if (simulationTimer) window.clearInterval(simulationTimer)
      simulationTimer = null
    }

    const clearTimers = () => {
      if (connectTimer) window.clearTimeout(connectTimer)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (countdownTimer) window.clearInterval(countdownTimer)
      if (simulationTimer) window.clearInterval(simulationTimer)
      connectTimer = null
      reconnectTimer = null
      countdownTimer = null
      simulationTimer = null
    }

    const scheduleReconnect = () => {
      if (!mounted) return
      const attemptVal = attemptRef.current
      const delay = RECONNECT_DELAYS_MS[Math.min(attemptVal, RECONNECT_DELAYS_MS.length - 1)]
      attemptRef.current += 1
      let secondsLeft = Math.ceil(delay / 1000)

      setWsStatus('degraded')
      setDemo(true)
      setReconnect(secondsLeft)
      setConnectionError(`reconnecting in ${secondsLeft}s`)
      startSimulation()

      if (countdownTimer) window.clearInterval(countdownTimer)
      countdownTimer = window.setInterval(() => {
        secondsLeft -= 1
        setReconnect(Math.max(0, secondsLeft))
      }, 1000)

      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      reconnectTimer = window.setTimeout(() => {
        if (countdownTimer) window.clearInterval(countdownTimer)
        countdownTimer = null
        setReconnect(null)
        connect()
      }, delay)
    }

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        // Validate message size
        const dataSize = new Blob([event.data]).size
        if (dataSize > MAX_MESSAGE_SIZE_BYTES) {
          console.warn('WebSocket message too large, discarding')
          return
        }

        const message = parseMessage(event.data)
        if (!message) {
          console.warn('Failed to parse WebSocket message:', event.data)
          return
        }

        // Track message count for rate limiting
        messageCountRef.current++
        if (messageCountRef.current > 1000) {
          messageCountRef.current = 0
          console.log('WebSocket message count reset')
        }

        if (message.type === 'ping') {
          sendJson(socket, { type: 'pong', ts: Date.now() })
          return
        }

        if (message.type === 'tick') {
          const tick = normalizeTick(message.payload ?? message)
          if (tick) {
            useTerminalStore.getState().ingestTick(tick)
          } else {
            console.warn('Invalid tick data received:', message.payload)
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
        setConnectionError('message processing error')
      }
    }

    function connect() {
      if (!mounted) return
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

      const attemptVal = attemptRef.current
      setWsStatus(attemptVal > 0 ? 'degraded' : 'connecting')
      setDemo(true)
      setConnectionError(null)

      try {
        socket = new WebSocket(WS_URL)

        connectTimer = window.setTimeout(() => {
          if (!mounted || socket?.readyState === WebSocket.OPEN) return
          setWsStatus('degraded')
          setDemo(true)
          setConnectionError('backend warming up')
          startSimulation()
        }, CONNECT_TIMEOUT_MS)

        socket.onopen = () => {
          if (!mounted) return
          if (connectTimer) window.clearTimeout(connectTimer)
          if (countdownTimer) window.clearInterval(countdownTimer)
          connectTimer = null
          countdownTimer = null
          attemptRef.current = 0
          setWsStatus('connected')
          setDemo(false)
          setReconnect(null)
          setConnectionError(null)
          stopSimulation()
        }

        socket.onmessage = handleMessage

        socket.onerror = () => {
          if (!mounted) return
          setWsStatus('degraded')
          setDemo(true)
          setConnectionError('websocket transport error')
          startSimulation()
        }

        socket.onclose = () => {
          if (!mounted) return
          if (connectTimer) window.clearTimeout(connectTimer)
          connectTimer = null
          socket = null
          scheduleReconnect()
        }
      } catch {
        setWsStatus('offline')
        setDemo(true)
        setConnectionError('websocket unavailable')
        startSimulation()
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimers()
      socket?.close()
      socket = null
    }
  }, [])

  return {
    wsStatus: normalizeStatus(wsStatus),
    demo,
    reconnectInSeconds,
  }
}

function parseMessage(data: string) {
  if (data.trim().toLowerCase() === 'ping') return { type: 'ping' }
  try {
    const parsed = JSON.parse(data) as { type?: unknown; payload?: unknown; [key: string]: unknown }
    return { ...parsed, type: String(parsed.type || '').toLowerCase() }
  } catch {
    return null
  }
}

function sendJson(socket: WebSocket | null, payload: unknown) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

function normalizeTick(payload: unknown): TickPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>

  // Validate and extract required fields
  if (!data || !('symbol' in data)) {
    console.warn('Tick payload missing symbol field')
    return null
  }

  const symbol = String(data.symbol)
  const ltp = Number(data.ltp ?? data.price)

  // Validate numeric fields
  if (symbol.length === 0 || symbol.length > 20) {
    console.warn('Invalid symbol length in tick payload')
    return null
  }

  if (!Number.isFinite(ltp) || ltp < 0) {
    console.warn('Invalid LTP value in tick payload:', data.ltp)
    return null
  }

  // Extract optional fields with validation
  const volume = 'volume' in data && Number.isFinite(Number(data.volume))
    ? Math.max(0, Number(data.volume))
    : undefined

  return {
    symbol,
    ltp,
    price: ltp,
    exchange: 'exchange' in data ? String(data.exchange) : undefined,
    token: 'token' in data ? String(data.token) : undefined,
    volume,
    received_at: new Date().toISOString(),
    mode: ('mode' in data && String(data.mode) === 'LIVE') ? 'LIVE' : 'PAPER',
  }
}

function normalizeStatus(status: WsConnectionStatus): FrontendWsStatus {
  if (status === 'CONNECTED' || status === 'connected') return 'connected'
  if (status === 'CONNECTING' || status === 'connecting') return 'connecting'
  if (status === 'OFFLINE' || status === 'offline') return 'offline'
  return 'degraded'
}
