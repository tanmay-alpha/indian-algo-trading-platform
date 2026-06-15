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
