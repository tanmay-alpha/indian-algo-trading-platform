'use client'
// This file is client-only. Never import in Server Components.

import { useEffect, useState } from 'react'

export function useIstClock(): string {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const ist = new Date(
        now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
      )
      const hh = String(ist.getHours()).padStart(2, '0')
      const mm = String(ist.getMinutes()).padStart(2, '0')
      const ss = String(ist.getSeconds()).padStart(2, '0')
      setTime(`${hh}:${mm}:${ss}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}
