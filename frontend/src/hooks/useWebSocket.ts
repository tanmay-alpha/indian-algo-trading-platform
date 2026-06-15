'use client';

import { useEffect, useRef, useState } from 'react';
import { wsBase } from '@/services/angelone';
import type { Quote } from '@/types/market';

const RECONNECT_DELAY_MS = 3000;
const MAX_RETRIES = 5;

export type UseWebSocketResult = {
  quotes: Record<string, Quote>;
  connected: boolean;
};

function parseFrame(raw: string): Quote | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const symbol = data.symbol ? String(data.symbol) : null;
  if (!symbol) return null;

  const ltp = Number(data.ltp ?? data.price ?? NaN);
  if (!Number.isFinite(ltp)) return null;

  return {
    symbol,
    ltp,
    open: Number(data.open ?? ltp),
    high: Number(data.high ?? ltp),
    low: Number(data.low ?? ltp),
    close: Number(data.close ?? ltp),
    change: Number(data.change ?? 0),
    changePct: Number(data.changePct ?? data.change_percent ?? 0),
    volume: Number(data.volume ?? 0),
    timestamp: String(data.timestamp ?? new Date().toISOString()),
  };
}

export function useWebSocket(symbols: string[] = []): UseWebSocketResult {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const shouldReconnectRef = useRef(true);
  const subscribedRef = useRef<Set<string>>(new Set());

  // Resolve the WS base URL once per mount. If empty (no backend configured)
  // we skip connecting entirely; the REST poll keeps the UI alive.
  const wsBaseUrl = wsBase();
  const url = wsBaseUrl ? `${wsBaseUrl}/ws/market` : '';
  const symbolsKey = symbols.slice().sort().join(',');

  useEffect(() => {
    mountedRef.current = true;
    shouldReconnectRef.current = true;
    subscribedRef.current = new Set();

    if (!url) {
      // No WS backend configured — stay disconnected, the REST poll keeps
      // the UI alive. No reconnect loop, no console errors.
      return;
    }

    const send = (payload: unknown) => {
      const sock = socketRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify(payload));
      }
    };

    const syncSubscriptions = () => {
      const want = new Set(symbols);
      for (const sym of subscribedRef.current) {
        if (!want.has(sym)) {
          send({ action: 'unsubscribe', symbol: sym });
          subscribedRef.current.delete(sym);
        }
      }
      for (const sym of want) {
        if (!subscribedRef.current.has(sym)) {
          send({ action: 'subscribe', symbol: sym });
          subscribedRef.current.add(sym);
        }
      }
    };

    const connect = () => {
      if (!mountedRef.current) return;
      try {
        const sock = new WebSocket(url);
        socketRef.current = sock;

        sock.onopen = () => {
          if (!mountedRef.current) return;
          retriesRef.current = 0;
          setConnected(true);
          syncSubscriptions();
        };

        sock.onmessage = (event) => {
          if (!mountedRef.current) return;
          if (typeof event.data !== 'string') return;
          const quote = parseFrame(event.data);
          if (!quote) return;
          setQuotes((prev) => ({ ...prev, [quote.symbol]: quote }));
        };

        sock.onerror = () => {
          // The close event will handle reconnection.
        };

        sock.onclose = () => {
          if (!mountedRef.current) return;
          setConnected(false);
          socketRef.current = null;
          subscribedRef.current = new Set();

          if (!shouldReconnectRef.current) return;

          if (retriesRef.current >= MAX_RETRIES) {
            shouldReconnectRef.current = false;
            return;
          }

          retriesRef.current += 1;
          if (reconnectTimerRef.current !== null) {
            window.clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, RECONNECT_DELAY_MS);
        };
      } catch {
        setConnected(false);
        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current += 1;
          reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const sock = socketRef.current;
      socketRef.current = null;
      if (sock) {
        try {
          sock.close();
        } catch {
          // ignore
        }
      }
      subscribedRef.current = new Set();
    };
  }, [url]);

  // Resync the subscription set whenever the symbol list changes — re-subscribes
  // to anything new, unsubscribes from anything removed, all on the live socket.
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    const want = new Set(symbols);
    for (const sym of subscribedRef.current) {
      if (!want.has(sym)) {
        try {
          sock.send(JSON.stringify({ action: 'unsubscribe', symbol: sym }));
        } catch {
          // ignore
        }
        subscribedRef.current.delete(sym);
      }
    }
    for (const sym of want) {
      if (!subscribedRef.current.has(sym)) {
        try {
          sock.send(JSON.stringify({ action: 'subscribe', symbol: sym }));
        } catch {
          // ignore
        }
        subscribedRef.current.add(sym);
      }
    }
  }, [symbolsKey, symbols]);

  return { quotes, connected };
}
