'use client'

import { cn } from '@/lib/utils'
import React, { useState, useRef, MouseEvent, ReactNode, useEffect } from 'react'

interface TiltCardProps {
  children: ReactNode
  className?: string
  intensity?: number // higher is more tilt (default 10)
}

export function TiltCard({ children, className, intensity = 10 }: TiltCardProps) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 })
  const [motionEnabled, setMotionEnabled] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    setMotionEnabled(!reduceMotion && !coarsePointer)
  }, [])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!motionEnabled) return
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    const mouseX = e.clientX - rect.left - width / 2
    const mouseY = e.clientY - rect.top - height / 2

    const rotateX = -(mouseY / (height / 2)) * intensity
    const rotateY = (mouseX / (width / 2)) * intensity

    setRotate({ x: rotateX, y: rotateY })
  }

  const handleMouseLeave = () => {
    if (!motionEnabled) return
    setRotate({ x: 0, y: 0 })
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'transition-transform duration-200 ease-out will-change-transform',
        className
      )}
      style={{
        transform: motionEnabled
          ? `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`
          : undefined,
      }}
    >
      {children}
    </div>
  )
}
