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
  const [clock, setClock] = useState<IstClock>(() => emptyIstClock())

  useEffect(() => {
    const tick = () => setClock(currentIstClock())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return clock
}

function emptyIstClock(): IstClock {
  return {
    time: '',
    date: '',
    session: 'POST_MARKET',
    sessionLabel: '',
  }
}

function currentIstClock(): IstClock {
  const now = new Date()
  const session = getNseMarketSession(now)
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const hh = String(ist.getHours()).padStart(2, '0')
  const mm = String(ist.getMinutes()).padStart(2, '0')
  const ss = String(ist.getSeconds()).padStart(2, '0')

  return {
    time: `${hh}:${mm}:${ss}`,
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
