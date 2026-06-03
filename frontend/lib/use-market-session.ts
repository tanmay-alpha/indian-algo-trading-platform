'use client'

import { useEffect, useState } from 'react'
import { getNseMarketSession } from './utils'
import type { NseMarketSession } from './types'

export function useMarketSession(): NseMarketSession {
  const [session, setSession] = useState<NseMarketSession>('CLOSED')

  useEffect(() => {
    const update = () => setSession(getNseMarketSession())
    update()

    const intervalId = window.setInterval(update, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  return session
}
