'use client'

import { useEffect, useState } from 'react'
import { getNseMarketSession } from './utils'
import type { NseMarketSession } from './types'

interface IstClock {
  time: string
  date: string
  session: NseMarketSession
  sessionLabel: string
}

export function useIstClock(): IstClock {
  const [clock, setClock] = useState<IstClock>(() => currentIstClock())

  useEffect(() => {
    const tick = () => setClock(currentIstClock())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return clock
}

function currentIstClock(): IstClock {
  const now = new Date()
  const session = getNseMarketSession(now)
  return {
    time: new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now),
    date: new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(now),
    session,
    sessionLabel: labelForSession(session),
  }
}

function labelForSession(session: NseMarketSession): string {
  if (session === 'OPEN') return 'MARKET OPEN'
  if (session === 'PRE_MARKET') return 'PRE-MARKET'
  if (session === 'POST_MARKET') return 'POST-MARKET'
  return 'WEEKEND'
}

