'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { WS_MAX_RECONNECT_ATTEMPTS, WS_RECONNECT_DELAY, WS_URL } from '@/lib/constants'
import type {
  BrokerStatus,
  GatewayStatus,
  SignalEvent,
  TickPayload,
  WsEnvelope,
} from '@/lib/types'

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)

  const setWsConnected = useTerminalStore((s) => s.setWsConnected)
  const setConnectionError = useTerminalStore((s) => s.setConnectionError)
  const incrementReconnect = useTerminalStore((s) => s.incrementReconnect)
  const resetReconnect = useTerminalStore((s) => s.resetReconnect)
  const setBrokerStatus = useTerminalStore((s) => s.setBrokerStatus)
  const ingestTick = useTerminalStore((s) => s.ingestTick)
  const ingestSignal = useTerminalStore((s) => s.ingestSignal)
  const ingestEvent = useTerminalStore((s) => s.ingestEvent)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setWsConnected(true)
        resetReconnect()
        setConnectionError(null)
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setWsConnected(false)
        const attempts = useTerminalStore.getState().wsReconnectAttempts
        if (attempts >= WS_MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('WebSocket reconnect limit reached')
          ingestEvent({
            event_type: 'error',
            component: 'WS',
            severity: 'error',
            message: 'WebSocket reconnect limit reached',
          })
          return
        }
        incrementReconnect()
        const delay = Math.min(WS_RECONNECT_DELAY * 2 ** attempts, 30_000)
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setConnectionError('WebSocket connection error')
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        handleEnvelope(event.data)
      }
    } catch {
      setConnectionError('Failed to create WebSocket connection')
    }
  }, [
    incrementReconnect,
    ingestEvent,
    resetReconnect,
    setConnectionError,
    setWsConnected,
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

      if (type === 'tick') {
        const tick = normalizeTickPayload(payload)
        if (tick) ingestTick(tick)
        return
      }

      if (type === 'signal') {
        const signal = normalizeSignalPayload(payload)
        if (signal) ingestSignal(signal)
        return
      }

      if (type === 'gateway_status') {
        const gateway = payload as GatewayStatus
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
    [ingestEvent, ingestSignal, ingestTick, setBrokerStatus]
  )

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

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
