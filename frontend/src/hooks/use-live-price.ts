"use client";

import { useEffect, useRef, useState } from "react";
import { getWSClient, type ConnState, type TickMsg } from "@/lib/ws-client";

export type LivePrice = {
  price: number;
  dir: "up" | "down" | "flat";
  tick: number;
  base: number;
  isStale: boolean;
  source: "live" | "mock" | "reconnecting";
};

type Opts = {
  /** Random-walk volatility used in mock fallback. */
  volatility?: number;
  /** Mock tick interval (ms). Ignored when a live WS feed is active. */
  interval?: number;
  /** Symbol to subscribe to on the WS feed. Required for live mode. */
  symbol?: string;
};

export function useLivePrice(seed: number, opts: Opts = {}): LivePrice {
  const { volatility = 0.0015, interval = 1200, symbol } = opts;
  const [price, setPrice] = useState(seed);
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat");
  const [tick, setTick] = useState(0);
  const [source, setSource] = useState<ConnState>("mock");
  // Mirror `source` in a ref so the mock-walk interval can read the latest
  // value without listing `source` as a dep — that dep would tear down and
  // restart the interval on every WS state transition, with the new walk
  // sometimes spawning a price that jumps against the previous live tick.
  const sourceRef = useRef<ConnState>("mock");
  const last = useRef(seed);
  const lastTickAt = useRef<number>(Date.now());
  const [isStale, setStale] = useState(false);

  // Mock random-walk — runs continuously but skips ticks when "live" so the
  // live subscription overwrites the value. Intentionally does NOT depend on
  // `source`: every WSClient state transition (mock → reconnecting → live →
  // reconnecting → mock) would otherwise tear down and restart the interval,
  // and the new walk could spawn a price that jumps against the previous live
  // tick. The live subscription effect overwrites price via setPrice()
  // whenever a real tick arrives, so a brief "live" overlay on top of the
  // mock walk is the desired behavior.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (sourceRef.current === "live") return;
      const drift = (Math.random() - 0.48) * 2 * volatility * last.current;
      const next = +(last.current + drift).toFixed(2);
      if (next === last.current) return;
      setDir(next > last.current ? "up" : "down");
      last.current = next;
      setPrice(next);
      setTick((t) => t + 1);
    }, interval);
    return () => window.clearInterval(id);
  }, [volatility, interval]);

  // Live WS subscription.
  useEffect(() => {
    if (!symbol) return;
    const client = getWSClient();
    const unsubState = client.onState((s) => {
      sourceRef.current = s;
      setSource(s);
    });
    const unsubMsg = client.subscribe(symbol, (msg: TickMsg) => {
      if (msg.type !== "tick" && msg.type !== "snapshot") return;
      const next = msg.ltp;
      if (!Number.isFinite(next)) return;
      setDir(next > last.current ? "up" : next < last.current ? "down" : "flat");
      last.current = next;
      setPrice(next);
      setTick((t) => t + 1);
      lastTickAt.current = Date.now();
      setStale(false);
    });
    return () => {
      unsubState();
      unsubMsg();
    };
  }, [symbol]);

  // Staleness: live source with no tick in 10s flips isStale.
  useEffect(() => {
    if (source !== "live") {
      setStale(source === "reconnecting");
      return;
    }
    const id = window.setInterval(() => {
      setStale(Date.now() - lastTickAt.current > 10_000);
    }, 2_000);
    return () => window.clearInterval(id);
  }, [source]);

  return {
    price,
    dir,
    tick,
    base: seed,
    isStale,
    source: source === "live" ? "live" : source === "reconnecting" ? "reconnecting" : "mock",
  };
}

export function useLiveSeries(
  seed: number,
  length = 80,
  opts: { volatility?: number; interval?: number } = {},
) {
  const { volatility = 0.003, interval = 900 } = opts;
  const [series, setSeries] = useState<number[]>(() => Array.from({ length }, () => seed));

  useEffect(() => {
    const arr = [seed];
    for (let i = 1; i < length; i++) {
      arr.push(
        +(arr[i - 1] + (Math.sin(i / 6) + (Math.random() - 0.5)) * seed * volatility).toFixed(2),
      );
    }
    setSeries(arr);
    const id = window.setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const next = +(last + (Math.random() - 0.48) * 2 * volatility * last).toFixed(2);
        return [...prev.slice(1), next];
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [seed, length, volatility, interval]);
  return series;
}
