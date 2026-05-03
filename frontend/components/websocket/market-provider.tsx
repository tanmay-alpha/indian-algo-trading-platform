'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import {
  WS_URL,
  WS_RECONNECT_DELAY,
  WS_MAX_RECONNECT_ATTEMPTS,
} from '@/lib/constants'
import type {
  TickPayload,
  SignalEvent,
  BrokerStatus,
  WsEnvelope,
} from '@/lib/types'

/**
 * Backend (api_server.py) broadcasts envelopes:
 *   { type: 'tick' | 'signal' | 'gateway_status' | 'session' | 'error' | 'log', payload, ts }
 *
 * The legacy /toggle_auto_pilot path also pushed messages without envelopes
 * via the older `/ws/terminal` route. We accept both for resilience.
 */

const TICK_TYPES = new Set(['tick', 'TICK'])
const SIGNAL_TYPES = new Set(['signal', 'SIGNAL'])
const GATEWAY_TYPES = new Set(['gateway_status', 'GATEWAY_STATUS'])
const SESSION_TYPES = new Set(['session', 'SESSION'])
const ERROR_TYPES = new Set(['error', 'ERROR'])
const LOG_TYPES = new Set(['log', 'LOG', 'portfolio', 'PORTFOLIO'])

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const attemptsRef = useRef(0)

  const setWsConnected = useTerminalStore((s) => s.setWsConnected)
  const setConnectionError = useTerminalStore((s) => s.setConnectionError)
  const ingestTick = useTerminalStore((s) => s.ingestTick)
  const ingestSignal = useTerminalStore((s) => s.ingestSignal)
  const ingestEvent = useTerminalStore((s) => s.ingestEvent)
  const setBrokerStatus = useTerminalStore((s) => s.setBrokerStatus)
  const incrementReconnect = useTerminalStore((s) => s.incrementReconnect)
  const resetReconnect = useTerminalStore((s) => s.resetReconnect)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(WS_URL)
    } catch {
      setConnectionError('Failed to open WebSocket')
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      attemptsRef.current = 0
      resetReconnect()
      setWsConnected(true)
      setConnectionError(null)
      ingestEvent({
        event_type: 'ws_open',
        component: 'WS',
        severity: 'success',
        message: `Stream connected: ${WS_URL}`,
      })
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return
      setWsConnected(false)
      if (!event.wasClean) {
        ingestEvent({
          event_type: 'ws_close',
          component: 'WS',
          severity: 'warning',
          message: `Stream lost (code ${event.code})`,
        })
      }
      scheduleReconnect()
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setConnectionError('WebSocket error')
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const raw = JSON.parse(e.data) as WsEnvelope | Record<string, unknown>
        handleMessage(raw)
      } catch {
        /* ignore non-JSON */
      }
    }
  }, [
    setWsConnected,
    setConnectionError,
    resetReconnect,
    ingestEvent,
  ])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (attemptsRef.current >= WS_MAX_RECONNECT_ATTEMPTS) {
      setConnectionError('Max reconnect attempts reached')
      ingestEvent({
        event_type: 'ws_giveup',
        component: 'WS',
        severity: 'error',
        message: 'Max reconnection attempts reached',
      })
      return
    }
    const attempt = attemptsRef.current
    const delay = Math.min(WS_RECONNECT_DELAY * Math.pow(1.6, attempt), 20_000)
    attemptsRef.current = attempt + 1
    incrementReconnect()
    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) connect()
    }, delay)
  }, [connect, incrementReconnect, ingestEvent, setConnectionError])

  const handleMessage = useCallback(
    (msg: WsEnvelope | Record<string, unknown>) => {
      // Envelope: { type, payload, ts }
      const type = (msg as WsEnvelope).type
      const payload =
        ((msg as WsEnvelope).payload as Record<string, unknown> | undefined) ??
        // Legacy: fields flattened on root
        (msg as Record<string, unknown>)

      if (typeof type !== 'string') return

      if (TICK_TYPES.has(type)) {
        const tick = payload as TickPayload
        if (tick && tick.symbol) ingestTick(tick)
        return
      }

      if (SIGNAL_TYPES.has(type)) {
        const sig = payload as SignalEvent
        if (sig && sig.symbol && sig.action) ingestSignal(sig)
        return
      }

      if (GATEWAY_TYPES.has(type)) {
        const gw = payload as Partial<BrokerStatus> & { gateway?: unknown }
        // Accept either flat broker payload or nested gateway field
        if (gw) {
          setBrokerStatus({
            configured: !!gw.configured,
            logged_in: !!gw.logged_in,
            feed_token_available: !!gw.feed_token_available,
            websocket_started: !!gw.websocket_started,
            last_error: (gw.last_error as string | null) ?? null,
            gateway: gw.gateway as BrokerStatus['gateway'],
          })
        }
        return
      }

      if (SESSION_TYPES.has(type)) {
        ingestEvent({
          event_type: 'session',
          component: 'BROKER',
          severity: 'info',
          message: `Session: ${JSON.stringify(payload).slice(0, 120)}`,
          payload,
        })
        return
      }

      if (ERROR_TYPES.has(type)) {
        const err = (payload as { message?: string; error?: string }) ?? {}
        ingestEvent({
          event_type: 'error',
          component: 'STREAM',
          severity: 'error',
          message: err.message ?? err.error ?? 'Stream error',
          payload,
        })
        return
      }

      if (LOG_TYPES.has(type)) {
        const m = (payload as { message?: string }) ?? {}
        ingestEvent({
          event_type: type.toLowerCase(),
          component: 'STREAM',
          severity: 'info',
          message: m.message ?? type,
          payload,
        })
        return
      }

      // Unknown event type — surface to events tab safely
      ingestEvent({
        event_type: type,
        component: 'STREAM',
        severity: 'info',
        message: `Unhandled event "${type}"`,
        payload,
      })
    },
    [ingestTick, ingestSignal, setBrokerStatus, ingestEvent]
  )

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
