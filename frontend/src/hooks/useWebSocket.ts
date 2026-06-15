'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE } from '@/services/angelone';
import type { Quote } from '@/types/market';

const RECONNECT_DELAY_MS = 3000;
const MAX_RETRIES = 5;

export type UseWebSocketResult = {
  quotes: Record<string, Quote>;
  connected: boolean;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
};

function toWsUrl(base: string, path: string): string {
  return base.replace(/^http/i, 'ws') + path;
}

export function useWebSocket(): UseWebSocketResult {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const shouldReconnectRef = useRef(true);
  const fallbackPollersRef = useRef<Map<string, number>>(new Map());

  const url = toWsUrl(BASE, '/ws/market');

  const send = useCallback((payload: unknown) => {
    const sock = socketRef.current;
    if (sock && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(payload));
    }
  }, []);

  const subscribe = useCallback(
    (symbol: string) => {
      send({ action: 'subscribe', symbol });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (symbol: string) => {
      send({ action: 'unsubscribe', symbol });
    },
    [send]
  );

  useEffect(() => {
    mountedRef.current = true;
    shouldReconnectRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;
      try {
        const sock = new WebSocket(url);
        socketRef.current = sock;

        sock.onopen = () => {
          if (!mountedRef.current) return;
          retriesRef.current = 0;
          setConnected(true);
        };

        sock.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const data =
              typeof event.data === 'string'
                ? (JSON.parse(event.data) as Record<string, unknown>)
                : null;
            if (!data) return;

            const symbol = data.symbol ? String(data.symbol) : null;
            if (!symbol) return;

            const ltp = Number(data.ltp ?? data.price ?? NaN);
            if (!Number.isFinite(ltp)) return;

            const next: Quote = {
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

            setQuotes((prev) => ({ ...prev, [symbol]: next }));
          } catch {
            // Malformed frame — drop silently.
          }
        };

        sock.onerror = () => {
          // The close event will handle reconnection.
        };

        sock.onclose = () => {
          if (!mountedRef.current) return;
          setConnected(false);
          socketRef.current = null;

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
      // Clear any fallback pollers
      fallbackPollersRef.current.forEach((id) => window.clearInterval(id));
      fallbackPollersRef.current.clear();
    };
  }, [url]);

  return { quotes, connected, subscribe, unsubscribe };
}
