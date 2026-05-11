'use client'

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
let currentTime = Date.now()

function startClock() {
  if (timer) return
  timer = setInterval(() => {
    currentTime = Date.now()
    listeners.forEach((listener) => listener())
  }, 1000)
}

function stopClock() {
  if (!timer || listeners.size > 0) return
  clearInterval(timer)
  timer = null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  startClock()
  return () => {
    listeners.delete(listener)
    stopClock()
  }
}

function getSnapshot() {
  return currentTime
}

function getServerSnapshot() {
  return 0
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
