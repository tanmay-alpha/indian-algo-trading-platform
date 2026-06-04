'use client'
// This file is client-only. Never import in Server Components.

import { useEffect, useState } from 'react'

export function useIstClock(): string {
  const [time, setTime] = useState('--:--:--')

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date())
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}
