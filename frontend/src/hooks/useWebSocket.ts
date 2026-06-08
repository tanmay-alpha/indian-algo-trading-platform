'use client'

import { useEffect } from 'react'
import { WS_URL } from '@/lib/constants'
import { useTerminalStore } from '@/store/terminal-store'
import type { TickPayload, WsConnectionStatus } from '@/lib/types'

export type FrontendWsStatus = 'connected' | 'connecting' | 'degraded' | 'offline'

const CONNECT_TIMEOUT_MS = 4000
const RECONNECT_DELAYS_MS = [2000, 4000, 8000, 16_000, 30_000]

export function useWebSocket() {
  const wsStatus = useTerminalStore((state) => state.wsStatus)
  const demo = useTerminalStore((state) => state.wsDemoMode)
  const reconnectInSeconds = useTerminalStore((state) => state.wsReconnectInSeconds)

  useEffect(() => {
    let socket: WebSocket | null = null
    let mounted = true
    let connectTimer: number | null = null
    let reconnectTimer: number | null = null
    let countdownTimer: number | null = null
    let attempt = 0

    const setWsStatus = (status: WsConnectionStatus) => useTerminalStore.getState().setWsStatus(status)
    const setDemo = (value: boolean) => useTerminalStore.getState().setWsDemoMode(value)
    const setReconnect = (seconds: number | null) => useTerminalStore.getState().setWsReconnectInSeconds(seconds)
    const setConnectionError = (message: string | null) => useTerminalStore.getState().setConnectionError(message)

    const clearTimers = () => {
      if (connectTimer) window.clearTimeout(connectTimer)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (countdownTimer) window.clearInterval(countdownTimer)
      connectTimer = null
      reconnectTimer = null
      countdownTimer = null
    }

    const scheduleReconnect = () => {
      if (!mounted) return
      const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]
      attempt += 1
      let secondsLeft = Math.ceil(delay / 1000)

      setWsStatus('degraded')
      setDemo(true)
      setReconnect(secondsLeft)
      setConnectionError(`reconnecting in ${secondsLeft}s`)

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
      const message = parseMessage(event.data)
      if (!message) return

      if (message.type === 'ping') {
        sendJson(socket, { type: 'pong', ts: Date.now() })
        return
      }

      if (message.type === 'tick') {
        const tick = normalizeTick(message.payload ?? message)
        if (tick) useTerminalStore.getState().ingestTick(tick)
      }
    }

    function connect() {
      if (!mounted) return
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

      setWsStatus(attempt > 0 ? 'degraded' : 'connecting')
      setDemo(true)
      setConnectionError(null)

      try {
        socket = new WebSocket(WS_URL)

        connectTimer = window.setTimeout(() => {
          if (!mounted || socket?.readyState === WebSocket.OPEN) return
          setWsStatus('degraded')
          setDemo(true)
          setConnectionError('backend warming up')
        }, CONNECT_TIMEOUT_MS)

        socket.onopen = () => {
          if (!mounted) return
          if (connectTimer) window.clearTimeout(connectTimer)
          if (countdownTimer) window.clearInterval(countdownTimer)
          connectTimer = null
          countdownTimer = null
          attempt = 0
          setWsStatus('connected')
          setDemo(false)
          setReconnect(null)
          setConnectionError(null)
        }

        socket.onmessage = handleMessage

        socket.onerror = () => {
          if (!mounted) return
          setWsStatus('degraded')
          setDemo(true)
          setConnectionError('websocket transport error')
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
  const symbol = typeof data.symbol === 'string' ? data.symbol : null
  const ltp = Number(data.ltp ?? data.price)
  if (!symbol || !Number.isFinite(ltp)) return null

  return {
    symbol,
    ltp,
    price: ltp,
    exchange: typeof data.exchange === 'string' ? data.exchange : undefined,
    token: typeof data.token === 'string' ? data.token : undefined,
    volume: Number.isFinite(Number(data.volume)) ? Number(data.volume) : undefined,
    received_at: new Date().toISOString(),
    mode: data.mode === 'LIVE' ? 'LIVE' : 'PAPER',
  }
}

function normalizeStatus(status: WsConnectionStatus): FrontendWsStatus {
  if (status === 'CONNECTED' || status === 'connected') return 'connected'
  if (status === 'CONNECTING' || status === 'connecting') return 'connecting'
  if (status === 'OFFLINE' || status === 'offline') return 'offline'
  return 'degraded'
}
