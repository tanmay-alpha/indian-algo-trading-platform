'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface MagneticCardProps {
  children: ReactNode
  className?: string
  strength?: number
}

export function MagneticCard({ children, className, strength = 8 }: MagneticCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [motionEnabled, setMotionEnabled] = useState(false)
  const [transform, setTransform] = useState<string>()

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    setMotionEnabled(!reduceMotion && !coarsePointer)
  }, [])

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!motionEnabled) return
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    const translateX = x * strength
    const translateY = y * strength
    const rotateX = y * Math.min(strength * 0.34, 4)
    const rotateY = -x * Math.min(strength * 0.34, 4)

    setTransform(
      `perspective(1200px) translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`
    )
  }

  const handleMouseLeave = () => {
    if (!motionEnabled) return
    setTransform(undefined)
  }

  return (
    <div
      ref={cardRef}
      data-effect="magnetic-card"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('transition-transform duration-200 ease-out will-change-transform', className)}
      style={{ transform }}
    >
      {children}
    </div>
  )
}
