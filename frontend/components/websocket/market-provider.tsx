'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { WS_URL } from '@/lib/constants'
import { fetchTerminalStatus } from '@/lib/api'
import type {
  BrokerStatus,
  GatewayStatus,
  SignalEvent,
  TickPayload,
  WsEnvelope,
} from '@/lib/types'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]
const CLIENT_PING_INTERVAL_MS = 25_000
const REST_STATUS_POLL_MS = 10_000

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(false)

  const setWsConnected = useTerminalStore((s) => s.setWsConnected)
  const setWsStatus = useTerminalStore((s) => s.setWsStatus)
  const setConnectionError = useTerminalStore((s) => s.setConnectionError)
  const setReconnectAttempt = useTerminalStore((s) => s.setReconnectAttempt)
  const setStatusSource = useTerminalStore((s) => s.setStatusSource)
  const setTerminalStatus = useTerminalStore((s) => s.setTerminalStatus)
  const setBackendOffline = useTerminalStore((s) => s.setBackendOffline)
  const setBrokerStatus = useTerminalStore((s) => s.setBrokerStatus)
  const ingestTick = useTerminalStore((s) => s.ingestTick)
  const ingestSignal = useTerminalStore((s) => s.ingestSignal)
  const ingestEvent = useTerminalStore((s) => s.ingestEvent)

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  const startPingInterval = useCallback(() => {
    clearPingInterval()
    pingIntervalRef.current = setInterval(() => {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }))
      }
    }, CLIENT_PING_INTERVAL_MS)
  }, [clearPingInterval])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    const scheduleReconnect = (attempt: number) => {
      if (!mountedRef.current) return
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)]
      setWsStatus('RECONNECTING')
      setWsConnected(false)
      setReconnectAttempt(attempt + 1)
      setConnectionError(`WebSocket reconnecting (attempt ${attempt + 1})`)
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    try {
      setWsStatus(
        useTerminalStore.getState().reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING'
      )
      console.info(`[WS] connecting to ${safeWsTarget(WS_URL)}`)
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        clearPingInterval()
        setWsConnected(true)
        setWsStatus('CONNECTED')
        setReconnectAttempt(0)
        setStatusSource('WS')
        setBackendOffline(false)
        setConnectionError(null)
        startPingInterval()
      }

      ws.onclose = (event) => {
        if (!mountedRef.current) return
        clearPingInterval()
        setWsConnected(false)
        const attempt = useTerminalStore.getState().reconnectAttempt
        ingestEvent({
          event_type: 'log',
          component: 'WS',
          severity: 'warning',
          message: `WebSocket closed; reconnecting attempt ${attempt + 1} (${event.code || 'no-code'})`,
        })
        scheduleReconnect(attempt)
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setWsStatus('RECONNECTING')
        setConnectionError(
          `WebSocket transport error; reconnecting (attempt ${useTerminalStore.getState().reconnectAttempt + 1})`
        )
        ingestEvent({
          event_type: 'error',
          component: 'WS',
          severity: 'warning',
          message: 'WebSocket transport error; reconnecting',
        })
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        handleEnvelope(event.data)
      }
    } catch {
      if (!mountedRef.current) return
      clearPingInterval()
      setWsConnected(false)
      const attempt = useTerminalStore.getState().reconnectAttempt
      setConnectionError(`Failed to create WebSocket connection; reconnecting (attempt ${attempt + 1})`)
      ingestEvent({
        event_type: 'error',
        component: 'WS',
        severity: 'warning',
        message: 'Failed to create WebSocket connection; reconnecting',
      })
      scheduleReconnect(attempt)
    }
  }, [
    clearPingInterval,
    ingestEvent,
    setBackendOffline,
    setConnectionError,
    setReconnectAttempt,
    setStatusSource,
    setWsStatus,
    setWsConnected,
    startPingInterval,
  ])

  const handleEnvelope = useCallback(
    (raw: string) => {
      let message: WsEnvelope
      try {
        message = JSON.parse(raw) as WsEnvelope
      } catch {
        ingestEvent({
          event_type: 'error',
          component: 'WS',
          severity: 'warning',
          message: 'Ignored malformed WebSocket message',
        })
        return
      }

      const type = normalizeType(message.type)
      const payload = message.payload ?? message

      if (type === 'ping') return
      if (type === 'pong') {
        setStatusSource('WS')
        return
      }

      if (type === 'tick') {
        const tick = normalizeTickPayload(payload)
        if (tick) {
          setStatusSource('WS')
          ingestTick(tick)
        }
        return
      }

      if (type === 'signal') {
        const signal = normalizeSignalPayload(payload)
        if (signal) ingestSignal(signal)
        return
      }

      if (type === 'gateway_status') {
        const gateway = payload as GatewayStatus
        setStatusSource('WS')
        ingestEvent({
          event_type: 'gateway_status',
          component: 'GATEWAY',
          severity: gateway.last_error ? 'warning' : 'info',
          message: gateway.connection_state ?? 'Gateway status update',
          payload: gateway,
        })
        return
      }

      if (type === 'session') {
        const sessionPayload = payload as Partial<BrokerStatus>
        setStatusSource('WS')
        setBrokerStatus({
          configured: Boolean(sessionPayload.configured ?? true),
          logged_in: Boolean(sessionPayload.logged_in),
          feed_token_available: Boolean(sessionPayload.feed_token_available),
          websocket_started: Boolean(sessionPayload.websocket_started),
          last_error: (sessionPayload.last_error as string | null | undefined) ?? null,
        })
        return
      }

      if (type === 'error' || type === 'log') {
        ingestEvent({
          event_type: type,
          component: type === 'error' ? 'WS' : 'LOG',
          severity: type === 'error' ? 'error' : 'info',
          message: extractMessage(payload),
          payload,
        })
        return
      }

      ingestEvent({
        event_type: type || 'unknown',
        component: 'WS',
        severity: 'info',
        message: `Unhandled event: ${type || 'unknown'}`,
        payload: message,
      })
    },
    [ingestEvent, ingestSignal, ingestTick, setBrokerStatus, setStatusSource]
  )

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      clearPingInterval()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [clearPingInterval, connect])

  useEffect(() => {
    const pollStatus = async () => {
      const state = useTerminalStore.getState()
      if (state.wsStatus === 'CONNECTED') return
      try {
        const status = await fetchTerminalStatus()
        if (!mountedRef.current || useTerminalStore.getState().wsStatus === 'CONNECTED') return
        setTerminalStatus(status)
        setBrokerStatus(status.broker ?? null)
        setBackendOffline(false)
        setStatusSource('REST')
      } catch {
        if (!mountedRef.current) return
        setBackendOffline(true)
        setStatusSource('NONE')
      }
    }

    const id = setInterval(pollStatus, REST_STATUS_POLL_MS)
    void pollStatus()
    return () => clearInterval(id)
  }, [setBackendOffline, setBrokerStatus, setStatusSource, setTerminalStatus])

  return <>{children}</>
}

function normalizeType(type: unknown): string {
  return String(type || '').trim().toLowerCase()
}

function normalizeTickPayload(payload: unknown): TickPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const symbol = asString(data.symbol)
  const ltp = asNumber(data.ltp ?? data.price)
  if (!symbol || ltp == null) return null
  return {
    symbol,
    token: asString(data.token),
    exchange: asString(data.exchange),
    ltp,
    price: ltp,
    best_bid: asNumber(data.best_bid),
    best_ask: asNumber(data.best_ask),
    spread: asNumber(data.spread),
    vwap: asNumber(data.vwap),
    volume: asNumber(data.volume),
    bid_qty: asNumber(data.bid_qty),
    ask_qty: asNumber(data.ask_qty),
    ltq: asNumber(data.ltq),
    exchange_timestamp: asString(data.exchange_timestamp ?? data.timestamp),
    received_at: asString(data.received_at),
    signal: asSignal(data.signal),
    portfolio:
      data.portfolio && typeof data.portfolio === 'object'
        ? (data.portfolio as TickPayload['portfolio'])
        : undefined,
    mode: data.mode === 'LIVE' ? 'LIVE' : 'PAPER',
    auto_pilot: Boolean(data.auto_pilot),
  }
}

function normalizeSignalPayload(payload: unknown): SignalEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const symbol = asString(data.symbol)
  if (!symbol) return null
  return {
    symbol,
    strategy_name: asString(data.strategy_name),
    action: asSignal(data.action) ?? 'NEUTRAL',
    strength: asNumber(data.strength),
    reason: asString(data.reason),
    ltp: asNumber(data.ltp),
    generated_at: asString(data.generated_at ?? data.occurred_at),
    quality: 'LIVE',
  }
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined
  return String(value)
}

function asNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function asSignal(value: unknown): 'BUY' | 'SELL' | 'NEUTRAL' | undefined {
  if (value === 'BUY' || value === 'SELL' || value === 'NEUTRAL') return value
  return undefined
}

function extractMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return String(payload ?? 'Event received')
  const data = payload as Record<string, unknown>
  return String(data.safe_message ?? data.message ?? data.error ?? 'Event received')
}

function safeWsTarget(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return 'configured WebSocket endpoint'
  }
}
