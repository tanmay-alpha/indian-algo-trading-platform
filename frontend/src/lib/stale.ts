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

/** Returns true when the row should be considered stale. */
export function isStale(lastTickAt: number | null | undefined, now: number, thresholdMs = 10_000): boolean {
  if (!lastTickAt) return true
  return now - lastTickAt > thresholdMs
}
