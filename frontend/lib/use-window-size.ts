'use client'

import { useEffect, useState } from 'react'

export interface WindowSize {
  width: number
  height: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

const TABLET_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : DESKTOP_BREAKPOINT,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  })

  useEffect(() => {
    // Start with initial size
    const width = window.innerWidth
    const height = window.innerHeight
    setWindowSize({
      width,
      height,
      isMobile: width < TABLET_BREAKPOINT,
      isTablet: width >= TABLET_BREAKPOINT && width < DESKTOP_BREAKPOINT,
      isDesktop: width >= DESKTOP_BREAKPOINT,
    })

    function handleResize() {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      setWindowSize({
        width: newWidth,
        height: newHeight,
        isMobile: newWidth < TABLET_BREAKPOINT,
        isTablet: newWidth >= TABLET_BREAKPOINT && newWidth < DESKTOP_BREAKPOINT,
        isDesktop: newWidth >= DESKTOP_BREAKPOINT,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}

/**
 * Simple hook that returns true if the viewport matches or exceeds the given breakpoint.
 * Use this for simple conditional rendering based on viewport width.
 */
export function useAtLeast(breakpoint: 'mobile' | 'tablet' | 'desktop'): boolean {
  const size = useWindowSize()
  switch (breakpoint) {
    case 'mobile':
      return size.isMobile || size.isTablet || size.isDesktop
    case 'tablet':
      return size.isTablet || size.isDesktop
    case 'desktop':
      return size.isDesktop
    default:
      return false
  }
}