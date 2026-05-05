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
const REST_POLL_FIRST_SUCCESS_MS = 5_000
const REST_POLL_RECONNECTING_MS = 10_000
const REST_POLL_STEADY_MS = 15_000
const BACKEND_WAKE_NOTICE_MS = 3_000

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
  const setBackendWakeState = useTerminalStore((s) => s.setBackendWakeState)
  const setApiReachability = useTerminalStore((s) => s.setApiReachability)
  const setBrokerStatus = useTerminalStore((s) => s.setBrokerStatus)
  const ingestGatewayStatus = useTerminalStore((s) => s.ingestGatewayStatus)
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

  const markWsHealthy = useCallback(() => {
    const state = useTerminalStore.getState()
    setWsConnected(true)
    setWsStatus('CONNECTED')
    setReconnectAttempt(0)
    setStatusSource('WS')
    setConnectionError(null)

    if (!state.lastStatusError || state.backendReachable || state.apiStatus !== 'OFFLINE') {
      setApiReachability(true)
      setBackendWakeState('ONLINE')
    }
  }, [
    setApiReachability,
    setBackendWakeState,
    setConnectionError,
    setReconnectAttempt,
    setStatusSource,
    setWsConnected,
    setWsStatus,
  ])

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
        markWsHealthy()
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
          message: `WebSocket closed: ${event.code || 'no-code'}`,
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
    markWsHealthy,
    setApiReachability,
    setBackendWakeState,
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
      markWsHealthy()

      if (type === 'ping') {
        sendPong(wsRef.current)
        return
      }
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
        const gateway = normalizeGatewayStatus(payload)
        setStatusSource('WS')
        ingestGatewayStatus(gateway)
        const broker = brokerStatusFromGatewayPayload(payload, gateway)
        if (broker) {
          setBrokerStatus(broker)
        }
        ingestEvent({
          event_type: 'gateway_status',
          component: 'GATEWAY',
          severity: gateway.last_error ? 'warning' : 'info',
          message: 'Gateway status received',
          payload: gatewayEventPreview(gateway),
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
    [
      ingestEvent,
      ingestGatewayStatus,
      ingestSignal,
      ingestTick,
      markWsHealthy,
      setBrokerStatus,
      setStatusSource,
    ]
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
    let timer: number | null = null
    let wakeTimer: number | null = null
    let firstSuccess = false

    const schedule = (delay: number) => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => void pollStatus(), delay)
    }

    const pollStatus = async () => {
      if (!mountedRef.current) return
      if (!firstSuccess) {
        if (wakeTimer) window.clearTimeout(wakeTimer)
        wakeTimer = window.setTimeout(() => {
          if (!firstSuccess && mountedRef.current) {
            const state = useTerminalStore.getState()
            if (!state.backendReachable && state.wsStatus !== 'CONNECTED') {
              setBackendWakeState('WAKING')
            }
          }
        }, BACKEND_WAKE_NOTICE_MS)
      }

      try {
        const status = await fetchTerminalStatus()
        if (!mountedRef.current) return
        firstSuccess = true
        if (wakeTimer) window.clearTimeout(wakeTimer)
        setTerminalStatus(status)
        setBrokerStatus(status.broker ?? null)
        setApiReachability(true)
        setBackendWakeState('ONLINE')
        setStatusSource(useTerminalStore.getState().wsStatus === 'CONNECTED' ? 'WS' : 'REST_FALLBACK')
      } catch (error) {
        if (!mountedRef.current) return
        if (wakeTimer) window.clearTimeout(wakeTimer)
        const state = useTerminalStore.getState()
        if (state.wsStatus === 'CONNECTED') {
          setStatusSource('WS')
          setBackendWakeState('ONLINE')
        } else {
          setApiReachability(false, error instanceof Error ? error.message : 'status fetch failed')
          setBackendWakeState(firstSuccess ? 'UNAVAILABLE' : 'WAKING')
          setStatusSource('NONE')
        }
      } finally {
        if (mountedRef.current) {
          const state = useTerminalStore.getState()
          const nextDelay = !firstSuccess
            ? REST_POLL_FIRST_SUCCESS_MS
            : state.wsStatus === 'CONNECTED'
            ? REST_POLL_STEADY_MS
            : REST_POLL_RECONNECTING_MS
          schedule(nextDelay)
        }
      }
    }

    void pollStatus()
    return () => {
      if (timer) window.clearTimeout(timer)
      if (wakeTimer) window.clearTimeout(wakeTimer)
    }
  }, [
    setApiReachability,
    setBackendWakeState,
    setBrokerStatus,
    setStatusSource,
    setTerminalStatus,
  ])

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

function normalizeGatewayStatus(payload: unknown): GatewayStatus {
  if (!payload || typeof payload !== 'object') return {}
  const data = payload as Record<string, unknown>
  const state = asString(data.connection_state ?? data.status)
  const subscribed = data.subscribed_symbols
  return {
    connection_state: isGatewayConnectionState(state) ? state : undefined,
    tick_count: asNumber(data.tick_count),
    dropped_tick_count: asNumber(data.dropped_tick_count),
    drop_rate_pct: asNumber(data.drop_rate_pct),
    subscribed_symbols:
      Array.isArray(subscribed) || typeof subscribed === 'number'
        ? (subscribed as GatewayStatus['subscribed_symbols'])
        : undefined,
    last_tick_age_seconds: asNumber(data.last_tick_age_seconds),
    last_error: asNullableString(data.last_error),
  }
}

function brokerStatusFromGatewayPayload(
  payload: unknown,
  gateway: GatewayStatus
): BrokerStatus | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const hasBrokerFields = [
    'configured',
    'logged_in',
    'feed_token_available',
    'websocket_started',
    'last_error',
  ].some((key) => key in data)
  if (!hasBrokerFields) return null

  const existing = useTerminalStore.getState().brokerStatus
  return {
    configured: asBool(data.configured, existing?.configured ?? false),
    logged_in: asBool(data.logged_in, existing?.logged_in ?? false),
    feed_token_available: asBool(
      data.feed_token_available,
      existing?.feed_token_available ?? false
    ),
    websocket_started: asBool(
      data.websocket_started,
      existing?.websocket_started ?? gateway.connection_state === 'CONNECTED'
    ),
    last_error: asNullableString(data.last_error) ?? existing?.last_error ?? null,
    gateway,
  }
}

function gatewayEventPreview(gateway: GatewayStatus): GatewayStatus {
  return {
    connection_state: gateway.connection_state,
    tick_count: gateway.tick_count,
    dropped_tick_count: gateway.dropped_tick_count,
    drop_rate_pct: gateway.drop_rate_pct,
    subscribed_symbols: gateway.subscribed_symbols,
    last_tick_age_seconds: gateway.last_tick_age_seconds,
    last_error: gateway.last_error,
  }
}

function sendPong(ws: WebSocket | null): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'pong', ts: new Date().toISOString() }))
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

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value == null) return fallback
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'online', 'connected'].includes(normalized)) return true
    if (['false', '0', 'no', 'offline', 'disconnected'].includes(normalized)) return false
  }
  return fallback
}

function asNullableString(value: unknown): string | null {
  if (value == null || value === '') return null
  return String(value)
}

function asSignal(value: unknown): 'BUY' | 'SELL' | 'NEUTRAL' | undefined {
  if (value === 'BUY' || value === 'SELL' || value === 'NEUTRAL') return value
  return undefined
}

function isGatewayConnectionState(value: string | undefined): value is NonNullable<GatewayStatus['connection_state']> {
  return (
    value === 'IDLE' ||
    value === 'CONNECTING' ||
    value === 'CONNECTED' ||
    value === 'RECONNECTING' ||
    value === 'DISCONNECTED'
  )
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
