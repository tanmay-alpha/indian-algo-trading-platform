// MAET WebSocket singleton — one connection per page, refcounted per symbol.
// Transport layer only. React-agnostic. Consumed by src/hooks/use-live-price.ts.
//
// Wire envelope (server → client):
//   { type: "tick" | "snapshot" | "heartbeat" | "error",
//     symbol: string, ltp: number, ts: number, vol?: number }
//
// Client → server:
//   { action: "subscribe" | "unsubscribe", symbols: string[] }
//   { action: "ping" }

export type TickMsg = {
  type: "tick" | "snapshot" | "heartbeat" | "error";
  symbol: string;
  ltp: number;
  ts: number;
  vol?: number;
};

export type ConnState = "live" | "reconnecting" | "mock";
type Listener = (msg: TickMsg) => void;
type StateListener = (s: ConnState) => void;

const PING_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;
const BACKOFF_CAP_MS = 30_000;
const SUBSCRIBE_BATCH_MS = 50;
// Cap reconnect attempts so a permanently-unreachable host (bad URL, 401 loop,
// expired token) doesn't fire setTimeout forever and leak timers.
const MAX_RECONNECT_ATTEMPTS = 8;

function resolveUrl(): string | null {
  const explicit = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_WS_URL) || "";
  if (explicit) return explicit;
  const backend = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL) || "";
  if (!backend) return null;
  return `${backend.replace(/^http/, "ws")}/ws/quotes`;
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

class WSClient {
  private ws: WebSocket | null = null;
  private state: ConnState = "mock";
  private attempt = 0;
  private pingTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private subscribeTimer: number | null = null;
  // Handle for the pending reconnect setTimeout, so we can cancel it on a
  // successful onopen or when the client transitions to mock mode.
  private reconnectTimer: number | null = null;
  private pendingSubs = new Set<string>();
  private pendingUnsubs = new Set<string>();
  private refcount = new Map<string, number>();
  private listeners = new Map<string, Set<Listener>>();
  private stateListeners = new Set<StateListener>();
  private mockMode = false;

  subscribe(symbol: string, fn: Listener): () => void {
    let set = this.listeners.get(symbol);
    if (!set) {
      set = new Set();
      this.listeners.set(symbol, set);
    }
    set.add(fn);

    const next = (this.refcount.get(symbol) ?? 0) + 1;
    this.refcount.set(symbol, next);
    if (next === 1) {
      this.pendingUnsubs.delete(symbol);
      this.pendingSubs.add(symbol);
      this.scheduleFlush();
      this.ensureConnection();
    }
    return () => this.release(symbol, fn);
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }

  getState(): ConnState {
    return this.state;
  }

  private release(symbol: string, fn: Listener) {
    const set = this.listeners.get(symbol);
    if (set) {
      set.delete(fn);
      if (set.size === 0) this.listeners.delete(symbol);
    }
    const next = (this.refcount.get(symbol) ?? 1) - 1;
    if (next <= 0) {
      this.refcount.delete(symbol);
      this.pendingSubs.delete(symbol);
      this.pendingUnsubs.add(symbol);
      this.scheduleFlush();
    } else {
      this.refcount.set(symbol, next);
    }
  }

  private setState(s: ConnState) {
    if (this.state === s) return;
    this.state = s;
    this.stateListeners.forEach((fn) => fn(s));
  }

  private ensureConnection() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.mockMode) return;
    this.connect();
  }

  private connect() {
    const base = resolveUrl();
    if (!base) {
      this.mockMode = true;
      this.setState("mock");
      return;
    }
    const token = readToken();
    if (!token) {
      this.mockMode = true;
      this.setState("mock");
      return;
    }
    const url = `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.setState("reconnecting");

    this.ws.onopen = () => {
      this.attempt = 0;
      // Clear any pending reconnect timer since we are now live.
      if (this.reconnectTimer != null) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.setState("live");
      // Re-subscribe all live symbols on (re)connect.
      const all = Array.from(this.refcount.keys());
      if (all.length) this.send({ action: "subscribe", symbols: all });
      this.startPing();
      this.armHeartbeat();
    };

    this.ws.onmessage = (ev) => {
      this.armHeartbeat();
      let msg: TickMsg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || !msg.type) return;
      if (msg.type === "heartbeat") return;
      if (msg.type === "error") return;
      const set = this.listeners.get(msg.symbol);
      if (set) set.forEach((fn) => fn(msg));
    };

    this.ws.onerror = () => {
      // onclose will follow; handle reconnect there.
    };

    this.ws.onclose = (ev) => {
      this.stopPing();
      this.ws = null;
      if (ev.code === 1000) {
        this.setState("mock");
        return;
      }
      if (ev.code === 4401 || ev.code === 401) {
        // Token rejected. The previous code only fell back to mock if the
        // token was missing *right now*, which let a stale-but-present token
        // loop `scheduleReconnect` forever. Any 401 means the credential is
        // bad — go to mock and let the session layer refresh the token.
        this.mockMode = true;
        this.setState("mock");
        this.attempt = MAX_RECONNECT_ATTEMPTS; // suppress further retries
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.refcount.size === 0) {
      this.setState("mock");
      return;
    }
    // Cap retries — if a host is permanently unreachable (bad URL, server
    // down, persistent 1006), don't leak setTimeout handles forever. Fall
    // back to mock so the UI keeps working with simulated ticks.
    if (this.attempt >= MAX_RECONNECT_ATTEMPTS) {
      this.mockMode = true;
      this.setState("mock");
      return;
    }
    this.setState("reconnecting");
    const base = Math.min(1000 * Math.pow(2, this.attempt), BACKOFF_CAP_MS);
    const jitter = base * (0.8 + Math.random() * 0.4);
    this.attempt += 1;
    // Clear any prior pending timer before scheduling a new one.
    if (this.reconnectTimer != null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnection();
    }, jitter);
  }

  private scheduleFlush() {
    if (this.subscribeTimer != null) return;
    this.subscribeTimer = window.setTimeout(() => {
      this.subscribeTimer = null;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // Will be flushed on next onopen via refcount snapshot.
        this.pendingSubs.clear();
        this.pendingUnsubs.clear();
        return;
      }
      if (this.pendingSubs.size) {
        this.send({ action: "subscribe", symbols: Array.from(this.pendingSubs) });
        this.pendingSubs.clear();
      }
      if (this.pendingUnsubs.size) {
        this.send({ action: "unsubscribe", symbols: Array.from(this.pendingUnsubs) });
        this.pendingUnsubs.clear();
      }
    }, SUBSCRIBE_BATCH_MS);
  }

  private send(payload: unknown) {
    try {
      this.ws?.send(JSON.stringify(payload));
    } catch {
      /* socket may have closed mid-flight */
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => this.send({ action: "ping" }), PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer != null) window.clearInterval(this.pingTimer);
    if (this.heartbeatTimer != null) window.clearTimeout(this.heartbeatTimer);
    this.pingTimer = null;
    this.heartbeatTimer = null;
  }

  private armHeartbeat() {
    if (this.heartbeatTimer != null) window.clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = window.setTimeout(() => {
      // No traffic for HEARTBEAT_TIMEOUT_MS — force close, reconnect path will fire.
      try {
        this.ws?.close(4000, "heartbeat-miss");
      } catch {
        /* ignore */
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }
}

let _client: WSClient | null = null;
export function getWSClient(): WSClient {
  if (typeof window === "undefined") {
    // SSR-safe shim: returns a no-op client. Real client mounts on first browser subscribe.
    return {
      subscribe: () => () => {},
      onState: (fn: StateListener) => {
        fn("mock");
        return () => {};
      },
      getState: () => "mock" as ConnState,
    } as unknown as WSClient;
  }
  if (!_client) _client = new WSClient();
  return _client;
}
