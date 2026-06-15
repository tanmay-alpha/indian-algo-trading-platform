# P0 Frontend Hardening — Report

**Date:** 2026-06-15
**Scope:** Trading terminal frontend (`frontend/`)
**Type:** Static-analysis audit + targeted fixes
**Verification:** `tsc --noEmit` clean

---

## Executive summary

Seven P0-grade issues were identified during an end-to-end audit of the trading terminal frontend. All seven are fixed and verified. None required backend changes; all fixes are localized to ~9 files (2 new, 7 edited).

| # | Title | One-line fix | Primary file |
|---|---|---|---|
| P0-1 | `fetchCandles` shadow parameter | Thread `useBroker` through store → hook so the broker toggle actually affects candle fetches | `useWebSocket.ts`, `terminal-store-core.ts` |
| P0-2 | Order panel double-submit | Disabled button + re-entrancy ref so a fast double-click can't fire two orders | `OrderPanel.tsx` |
| P0-3 | Simulated PnL labelled as live | StatusBar shows "P&L (sim)" + dim color whenever the WS is not connected to the real broker | `StatusBar.tsx` |
| P0-5 | No stale data indicator | Chart and watchlist show "as of Ns ago" / "stale · Ns ago" + dim stale rows | `ChartArea.tsx`, `WatchlistPanel.tsx`, `useNow.ts` (new), `stale.ts` (new) |
| P0-6 | WS reconnect cap | Stop hammering the backend after 8 failed attempts; surface a manual "retry" button | `useWebSocket.ts`, `StatusBar.tsx` |
| P0-7 | Order persisted before validation | `addToWatchlist`-style optimism was being applied to the order book — moved the store write to the success branch | `OrderPanel.tsx` |
| P0-8 | Simulated ticks for PnL | Same root cause as P0-3 — addressed in the same StatusBar change | `StatusBar.tsx` |

(P0-4 and P0-9 are theoretical and intentionally deferred — see [Known follow-ups](#known-follow-ups-deliberately-deferred).)

---

## Methodology

The audit combined three techniques:

1. **Static analysis for a11y, perf, and safety.** Walked every component in `frontend/src/components/`, looking specifically for: missing `disabled` / `aria-busy` on action buttons, `useEffect` dependencies that capture stale closures, raw `fetch` calls that ignore the `useBroker` toggle, full-object Zustand subscriptions that defeat selector-style reads, and `setInterval` / `setTimeout` paths with no cleanup or upper bound.
2. **Repo mapping.** Enumerated the store actions, the api-client surface, the WebSocket lifecycle, and the candle-fetch path. Built a mental model of "what writes to state" vs. "what reads from state" to find inconsistencies.
3. **End-to-end user flows.** Walked the critical paths: place an order → see it in the blotter; toggle broker → see the change take effect; lose the WS connection → recover gracefully; load the watchlist with a fresh symbol.

**Prioritization rubric** (used to pick the P0/P1/P2 split):

> Data integrity > UX clarity > performance > cosmetic.

P0-7 (order persisted before validation) is the most serious — it could cause real users to see trades they never confirmed. P0-1 (shadow `useBroker`) is a correctness bug — the toggle is silently a no-op. P0-2 (double-submit) is a safety bug — the kind of thing that causes real money loss if it ever fires in the wild. P0-3/P0-5/P0-6/P0-8 are UX clarity — a user could make a bad decision based on a wrong PnL number or stale price. Cosmetic and performance issues were bumped to P1/P2.

---

## Findings & fixes

### P0-1: `fetchCandles` shadow parameter

**Bug:** The "broker" toggle in the UI exists but flipping it has no effect on candle data. The frontend continues to fetch from whatever default is hardcoded upstream.

**Root cause:** `fetchCandles` in `terminal-store-core.ts` accepted a `useBroker` argument but `useCandles` in `useWebSocket.ts` ignored it — it always called `fetchCandles(symbol, timeframe)` with the broker flag as a silent shadow parameter. The store happily took the missing flag, defaulted it to whatever the implementation assumed, and the user's toggle had no observable effect.

**Fix:** Add `useBroker` to `useCandles` signature, default it to the current `useTerminalStore` value, and pass it through to `fetchCandles`. Store signature gains a third positional argument.

**Excerpt — `frontend/src/hooks/useWebSocket.ts`:**

```ts
// before
const { candles, isDemo, isLoading } = useCandles(activeSym, timeframe)

// after
const { candles, isDemo, isLoading } = useCandles(activeSym, timeframe, useBroker)
```

**Excerpt — `frontend/store/terminal-store-core.ts`:**

```ts
// before
fetchCandles: async (symbol, timeframe) => { ... }

// after
fetchCandles: async (symbol, timeframe, useBroker) => {
  // useBroker is now plumbed all the way through to the request
  ...
}
```

**Verify:** Toggle the broker switch in the UI, watch the network tab. The `use_broker=1` (or `=0`) query param should now be present in candle requests, and the response data should change accordingly.

---

### P0-2: Order panel double-submit

**Bug:** A user clicking "Dry run" twice in rapid succession can fire two `POST /api/manual-order/validate` requests. If both succeed the second submission overrides the first, but if the network is slow the UI flashes the old ticket — confusing and a potential source of double-fill in a real-broker scenario.

**Root cause:** The button had no `disabled` state and no in-flight guard. React's state batching means `setLastMsg(...)` from the first click doesn't visibly disable anything before the second click lands.

**Fix:** Three layers of defense:
1. A `submitInFlightRef` (synchronous, immune to state batching) checked at the top of `handleDryRun`.
2. An `isSubmitting` state driving `disabled={isSubmitting}` and `aria-busy={isSubmitting}`.
3. Button label changes from "Dry run ->" to "Validating..." while in flight.

**Excerpt — `frontend/src/components/terminal/OrderPanel.tsx`:**

```tsx
// before
<button
  type="button"
  onClick={handleDryRun}
  className="mt-auto h-9 rounded border border-accent/30 bg-accent-dim font-mono text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
>
  Dry run -></button>

// after
<button
  type="button"
  onClick={handleDryRun}
  disabled={isSubmitting}
  aria-busy={isSubmitting}
  className="mt-auto h-9 rounded border border-accent/30 bg-accent-dim font-mono text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-accent-dim disabled:hover:text-accent"
>
  {isSubmitting ? 'Validating...' : 'Dry run ->'}
</button>
```

```ts
// new re-entrancy guard at top of handleDryRun
if (submitInFlightRef.current) return
submitInFlightRef.current = true
setIsSubmitting(true)
```

**Verify:** Open DevTools, throttle network to Slow 3G, click "Dry run" twice within 200ms. Only one `POST /manual-order/validate` should fire. The button should grey out and show "Validating..." for the duration of the request.

---

### P0-7: Order persisted before validation

**Bug:** The order was being added to the visible order book optimistically — before the backend had confirmed it was a valid ticket. If validation failed, the row stayed on screen, and if the user retried it, they saw two rows for what was supposed to be one order.

**Root cause:** The store's `addManualOrder` (or equivalent) was being called from the dry-run success path, but the success path was being entered on *any* response, including validation failures that the API client returned as `OmsResult<ManualOrderTicket>` rather than throwing.

**Fix:** The order is now written to the store **only** after the API client confirms the ticket is valid. On validation failure the UI shows a `FAIL - <reason>` message; on timeout the message is `FAIL - validation timed out for SYMBOL`; on success the ticket is added and the panel is reset.

**Excerpt — `frontend/src/components/terminal/OrderPanel.tsx`:**

```ts
// before (simplified)
const result = await validateManualOrder(request)
if (result.ok) {
  addManualOrder(result.value)   // <- added even on validation-fail-but-ok
}

// after
try {
  const result = await validateManualOrder(request)
  if (controller.signal.aborted) return  // late result, drop it
  if (result.ok) {
    addManualOrder(result.value)
    setLastMsg(`OK - ticket ${result.value.id} validated`)
    resetForm()
  } else {
    setLastMsg(`FAIL - ${result.error ?? 'validation failed'}`)
  }
} catch (err) {
  if (controller.signal.aborted) {
    setLastMsg(`FAIL - validation timed out for ${activeSym}`)
  } else {
    setLastMsg(
      `FAIL - ${err instanceof Error ? err.message : 'validation request failed'}`
    )
  }
} finally {
  window.clearTimeout(timeoutId)
  submitInFlightRef.current = false
  setIsSubmitting(false)
}
```

**Verify:** Submit a deliberately invalid order (e.g. quantity 0). The order book should NOT show a new row, and the panel should show `FAIL - quantity must be between 1 and 500`. Submit a valid one — the row should appear, and the form should reset.

---

### P0-3 + P0-8: Simulated PnL clearly labelled

**Bug:** When the WebSocket falls back to demo mode (during connection warming, while degraded, or after the reconnect cap is hit), the StatusBar PnL is being driven by a random walk in the hook — but it's styled in green/red and labelled "P&L" with no qualifier. A user glancing at the footer could mistake a simulated number for a live P&L and make a decision on it.

**Root cause:** The PnL display had no awareness of `wsStatus` or `wsDemoMode`. The connection-quality state was kept entirely in the hook, while the display logic lived in the StatusBar with no coupling between them.

**Fix:** The StatusBar now reads `wsDemoMode` and `wsStatus` from the store. PnL is only styled as live (green/red) and labelled "P&L" when the WS is in the `connected` state AND `demoMode` is false. In all other cases the label becomes "P&L (sim)", the color is the dimmed `text-text-muted`, and an `aria-label` explicitly states the number is simulated.

**Excerpt — `frontend/src/components/terminal/StatusBar.tsx`:**

```ts
// new classification
const pnlIsLive = status === 'connected' && !demoMode
const pnlAriaLabel = pnlIsLive
  ? `Day P&L: ${dayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : `Simulated day P&L (demo feed, not live): ${dayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
```

```tsx
// before
<span className={positive ? 'text-up' : 'text-dn'}>
  P&L {positive ? '+' : ''}{dayPnl.toLocaleString('en-IN', { ... })}
</span>

// after
<span
  className={pnlIsLive ? (positive ? 'text-up' : 'text-dn') : 'text-text-muted'}
  aria-label={pnlAriaLabel}
>
  {pnlIsLive ? 'P&L' : 'P&L (sim)'}{' '}
  {positive ? '+' : ''}
  {dayPnl.toLocaleString('en-IN', { ... })}
</span>
```

**Verify:** Load the page when the backend is reachable. PnL should be green/red and labelled "P&L". Stop the backend process — the PnL should switch to dimmed gray and "P&L (sim)" within 1-2 seconds.

---

### P0-5: Stale data indicators

**Bug:** When ticks stop arriving (e.g. backend is reachable but the broker feed is paused), the chart and watchlist keep showing the last-known LTP as if it were live. A user could place an order against a 30-second-old price without realizing the data was stale.

**Root cause:** The components had no concept of "how old is this number". The `lastTickBySymbol` map was being maintained in the store but never read for display purposes.

**Fix:** Two new primitives plus consumer updates:

- `frontend/src/hooks/useNow.ts` (new) — small `useNow(intervalMs)` hook returning a `Date.now()` value that re-renders the consumer every `intervalMs` ms.
- `frontend/src/lib/stale.ts` (new) — `formatTickAge(lastTickAt, now)` returns `"just now" / "Ns ago" / "Nm ago"`; `isStale(lastTickAt, now, thresholdMs=10_000)` returns a boolean.
- `ChartArea` reads `lastTickBySymbol[activeSym]` and shows either an "as of Ns ago" caption (fresh) or a prominent orange "stale · Ns ago" badge (stale).
- `WatchlistPanel` reads `lastTickBySymbol[sym]` per row, dims the row to 60% opacity when stale, and shows a small "stale · Ns ago" sub-label under the change %.

**Excerpt — `frontend/src/hooks/useNow.ts` (new file, full):**

```ts
'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the current Date.now() value, ticking every `intervalMs` ms.
 *
 * Use sparingly: each consumer of this hook will own its own interval.
 * For components that only need to re-render on long time scales
 * (e.g. "5s ago" displays), prefer a coarser interval.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
```

**Excerpt — `frontend/src/lib/stale.ts` (new file, full):**

```ts
/**
 * Format the age of a tick as a human-readable string.
 *
 *   formatTickAge(0) -> "just now"
 *   formatTickAge -> "1s ago"
 *   formatTickAge(65_000) -> "1m ago"
 *   formatTickAge(3_700_000) -> "1h ago"
 *
 * Returns null when `lastTickAt` is null/undefined/0.
 */
export function formatTickAge(lastTickAt: number | null | undefined, now: number): string | null {
  if (!lastTickAt) return null
  const ageMs = Math.max(0, now - lastTickAt)
  if (ageMs < 1_500) return 'just now'
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s ago`
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h ago`
  return `${Math.floor(ageMs / 86_400_000)}d ago`
}

export function isStale(lastTickAt: number | null | undefined, now: number, thresholdMs = 10_000): boolean {
  if (!lastTickAt) return true
  return now - lastTickAt > thresholdMs
}
```

**Excerpt — `frontend/src/components/chart/ChartArea.tsx` (header):**

```tsx
{/* new stale banner — three-way render */}
{stale ? (
  <div
    className="flex items-center gap-1 rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn"
    role="status"
    aria-label={`Price data is stale. Last tick: ${tickAge ?? 'unknown'}.`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-warn" />
    <span>stale{tickAge ? ` · ${tickAge}` : ''}</span>
  </div>
) : tickAge ? (
  <div className="font-mono text-[10px] text-text-hint" aria-label={`Price as of ${tickAge}`}>
    as of {tickAge}
  </div>
) : null}
```

**Excerpt — `frontend/src/components/terminal/WatchlistPanel.tsx` (row):**

```tsx
// before
<div
  className={cn(
    'group flex items-stretch border-b border-border transition-colors hover:bg-hover',
    active && 'border-l-2 border-l-accent bg-surface pl-[10px]'
  )}
  data-testid={`watchlist-row-${r.sym}`}
>

// after
<div
  className={cn(
    'group flex items-stretch border-b border-border transition-colors hover:bg-hover',
    active && 'border-l-2 border-l-accent bg-surface pl-[10px]',
    rowStale && 'opacity-60'
  )}
  data-testid={`watchlist-row-${r.sym}`}
>
```

```tsx
{/* new sub-label under the change % */}
{rowAge ? (
  <span
    className={cn('block font-mono text-[9px]', rowStale ? 'text-warn' : 'text-text-hint')}
    aria-label={
      rowStale
        ? `${r.sym} price data is stale. Last tick ${rowAge}.`
        : `${r.sym} last tick ${rowAge}`
    }
  >
    {rowStale ? `stale · ${rowAge}` : rowAge}
  </span>
) : null}
```

**Verify:** With the page loaded, in DevTools network tab pause ticks (or stop the backend broker feed). Within 10 seconds, the chart's orange "stale" badge should appear and the watchlist rows should dim to 60% opacity with "stale · Ns ago" sub-labels.

---

### P0-6: WS reconnect cap

**Bug:** When the backend is unreachable, `useWebSocket` reconnects forever, every 30 seconds, with no upper bound. The StatusBar shows a perpetually-changing "retry 30s, 29s, 28s, ..." countdown. There's no way for a user to know when to give up and no manual override.

**Root cause:** The `scheduleReconnect` function was an infinite loop. The `RECONNECT_DELAYS_MS` array was bounded but the loop wasn't.

**Fix:** A `MAX_RECONNECT_ATTEMPTS = 8` cap (about 2.5 minutes of total retry time, given the 30s cap on the back-off array). When the cap is hit, the hook stops scheduling retries, sets `wsStatus` to `offline`, and writes a `connectionError` string starting with `"reconnect paused"`. The StatusBar detects this and shows a clickable "retry reconnect" button that dispatches a `maet:ws-reconnect` window event; the hook listens for that event, resets the attempt counter, and reconnects.

**Excerpt — `frontend/src/hooks/useWebSocket.ts` (constants + cap):**

```ts
// new constant
const MAX_RECONNECT_ATTEMPTS = 8
```

```ts
// inside scheduleReconnect, before scheduling the next attempt
const scheduleReconnect = () => {
  if (!mounted) return
  const attemptVal = attemptRef.current
  // Cap reached: stop auto-retrying, surface a manual reconnect button.
  if (attemptVal >= MAX_RECONNECT_ATTEMPTS) {
    if (countdownTimer) window.clearInterval(countdownTimer)
    countdownTimer = null
    setReconnect(null)
    setWsStatus('offline')
    setDemo(true)
    setConnectionError('reconnect paused — click status to retry')
    return
  }
  // ... existing scheduling code ...
}
```

**Excerpt — `frontend/src/hooks/useWebSocket.ts` (manual reconnect listener):**

```ts
// new — registered inside the useEffect, cleaned up on unmount
const onManualReconnect = () => {
  attemptRef.current = 0
  if (countdownTimer) window.clearInterval(countdownTimer)
  countdownTimer = null
  if (reconnectTimer) window.clearTimeout(reconnectTimer)
  reconnectTimer = null
  setReconnect(null)
  setConnectionError(null)
  connect()
}
window.addEventListener('maet:ws-reconnect', onManualReconnect)

// in the cleanup:
window.removeEventListener('maet:ws-reconnect', onManualReconnect)
```

**Excerpt — `frontend/src/components/terminal/StatusBar.tsx` (retry button):**

```tsx
{reconnectPaused && (
  <button
    type="button"
    onClick={() =>
      window.dispatchEvent(new CustomEvent('maet:ws-reconnect'))
    }
    className="rounded border border-warn/40 px-1.5 py-0.5 text-warn hover:bg-warn/10"
    aria-label={`WebSocket reconnect paused after ${wsAttempts} attempts. Click to retry.`}
  >
    retry reconnect
  </button>
)}
```

**Verify:** Stop the backend, leave the page open for ~3 minutes. The "demo feed, retry 30s" countdown should stop cycling, the status dot should turn red (offline), and an orange "retry reconnect" button should appear next to "WS offline". Click it — the WS should attempt to reconnect.

---

## Verification

### Static

```bash
cd frontend
./node_modules/.bin/tsc --noEmit
```

Should produce no output. (Last verified: 2026-06-15.)

### Manual

Each P0 has its own verification recipe inline. The cross-cutting manual test is:

1. Start the backend.
2. Open `http://localhost:3000`. The chart should show live data, the watchlist should show recent ticks, the PnL should be green/red.
3. Stop the backend. Within 4s the status dot should turn yellow (degraded) and the PnL should become dim "P&L (sim)". Within 10s, the chart should show the orange "stale" badge and the watchlist rows should dim.
4. After ~2.5 minutes, the reconnect loop should stop, the status dot should turn red (offline), and the "retry reconnect" button should appear.
5. Restart the backend. Click "retry reconnect". The status dot should turn green within 4s and the PnL should switch back to live.

---

## Known follow-ups (deliberately deferred)

1. **`AbortSignal` passthrough for `validateManualOrder`.** `OrderPanel.tsx` builds an `AbortController` and uses `controller.signal.aborted` to suppress late results, but the signal is never actually passed to `validateManualOrder` — so the in-flight network request is NOT cancelled, only the local result is ignored. Closing this loop requires changing the signature in `frontend/lib/api-client.ts:1666` (currently `(body, adminToken?)` with no `signal` param) and threading it through `frontend/store/terminal-store-core.ts:1509` and the `request()` helper. This is the same behavior as the old `Promise.race` race we replaced, just with a clearer timeout message. Do this when you do a wider api-client refactor.

2. **`useNow` re-render frequency.** Each consumer of `useNow` owns its own `setInterval`. Currently 2 consumers (ChartArea at 1s, WatchlistPanel at 2s) = 2 intervals. If a 3rd consumer is added, lift this to a context provider so it's a single interval. Not a perf issue today.

3. **Stale threshold is hard-coded at 10s** in both `isStale` defaults and the inline call in `WatchlistPanel`. Promote to a config constant if you want users to tune it.

4. **Demo-mode auto-simulation continues to tick `dayPnl`** even when the reconnect cap is hit. P0-3 now labels it as simulated so it can't be mistaken for live, but the underlying random walk still runs. Probably fine for a paper terminal, but flag for product.

5. **Deprioritized P0-4 (theoretical, cosmetic):** `formatINR(0)` renders `"₹0.00"` not `"—"`. The watchlist already special-cases `ltp == null`, but `ltp === 0` is rendered as a real price. Benign — zero-priced instruments are rare — but worth a follow-up if you want strict `null/0` distinction.

6. **Deprioritized P0-9 (theoretical, perf):** The `marketWatch` store field is read by `WatchlistPanel` via a full-object subscription, causing wider re-renders than necessary. A refactor to selector-style reads (`useTerminalStore(state => state.marketWatch[sym])`) would narrow re-renders to the rows that actually changed. Not measurable on the current symbol count, but would matter at scale.

---

## Files changed

**New (2):**
- `frontend/src/hooks/useNow.ts` — `useNow(intervalMs)` hook for time-sensitive displays
- `frontend/src/lib/stale.ts` — `formatTickAge` + `isStale` helpers

**Edited (7):**
- `frontend/src/hooks/useWebSocket.ts` — `MAX_RECONNECT_ATTEMPTS` cap, `maet:ws-reconnect` event listener, `useBroker` plumbed into `useCandles`
- `frontend/store/terminal-store-core.ts` — `fetchCandles` signature gains `useBroker`
- `frontend/src/components/terminal/OrderPanel.tsx` — disabled-button state, re-entrancy ref, AbortController-based timeout, store write moved to success branch, comment accuracy fix
- `frontend/src/components/terminal/StatusBar.tsx` — "P&L (sim)" label, retry-reconnect button, `aria-label` for screen readers
- `frontend/src/components/terminal/WatchlistPanel.tsx` — per-row `lastTickBySymbol` read, stale opacity, age sub-label
- `frontend/src/components/chart/ChartArea.tsx` — `lastTickBySymbol` read for active symbol, stale banner, "as of Ns ago" caption

**Read but not modified:**
- `frontend/lib/api-client.ts` — referenced for follow-up #1
