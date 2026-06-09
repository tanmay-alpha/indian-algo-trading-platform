'use client'

import { useRef, useCallback, useEffect } from 'react'

export interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export interface SwipeConfig {
  /** Minimum distance in pixels to trigger a swipe. Default: 50 */
  threshold?: number
  /** Max movement on perpendicular axis allowed during swipe. Default: 75 */
  restraint?: number
  /** Max time in ms for a swipe gesture. Default: 500 */
  allowedTime?: number
}

/**
 * Custom React hook for touch swipe gestures.
 * Works on mobile devices with touch events.
 * Used for tab transitions in the mobile terminal shell, similar to Groww / Zerodha Kite.
 *
 * Usage:
 *   const swipe = useSwipeGesture({
 *     onSwipeLeft: () => navigateToNext(),
 *     onSwipeRight: () => navigateToPrevious(),
 *   })
 *   return <div onTouchStart={swipe.onTouchStart}>...</div>
 */
export function useSwipeGesture(
  handlers: SwipeHandlers,
  config: SwipeConfig = {}
) {
  const {
    threshold = 50,
    restraint = 75,
    allowedTime = 500,
  } = config

  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0]
    if (!touch) return

    const startX = touch.pageX
    const startY = touch.pageY
    const startTime = Date.now()
    const target = e.currentTarget as HTMLElement

    const handleEnd = (ev: TouchEvent) => {
      target.removeEventListener('touchend', handleEnd as EventListener)
      const t = ev.changedTouches[0]
      if (!t) return

      const distX = t.pageX - startX
      const distY = t.pageY - startY
      const elapsed = Date.now() - startTime

      if (elapsed > allowedTime) return

      const h = handlersRef.current
      // Horizontal swipes
      if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) {
        if (distX > 0) h.onSwipeRight?.()
        else h.onSwipeLeft?.()
      }
      // Vertical swipes
      else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) {
        if (distY > 0) h.onSwipeDown?.()
        else h.onSwipeUp?.()
      }
    }

    target.addEventListener('touchend', handleEnd as EventListener, { passive: true })
  }, [threshold, restraint, allowedTime])

  return { onTouchStart }
}
