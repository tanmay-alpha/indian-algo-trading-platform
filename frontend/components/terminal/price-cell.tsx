'use client'

import { useEffect, useRef, useState } from 'react'
import { cn, fmtPrice } from '@/lib/utils'

interface Props {
  value: number | null | undefined
  decimals?: number
  className?: string
  flash?: boolean
  prefix?: string
}

export function PriceCell({
  value,
  decimals = 2,
  className,
  flash = true,
  prefix,
}: Props) {
  const prevRef = useRef<number | null>(null)
  const [dir, setDir] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (value == null || !flash) return
    const prev = prevRef.current
    if (prev != null && value !== prev) {
      setDir(value > prev ? 'up' : 'down')
      const t = setTimeout(() => setDir(null), 450)
      return () => clearTimeout(t)
    }
    prevRef.current = value
  }, [value, flash])

  return (
    <span
      className={cn(
        'font-mono tnum',
        dir === 'up' && 'flash-up',
        dir === 'down' && 'flash-down',
        className
      )}
    >
      {prefix}
      {fmtPrice(value ?? null, decimals)}
    </span>
  )
}
