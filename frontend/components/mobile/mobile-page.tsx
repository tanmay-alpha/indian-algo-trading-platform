'use client'

import type { ReactNode } from 'react'

interface MobilePageProps {
  children: ReactNode
  className?: string
}

export function MobilePage({ children, className = '' }: MobilePageProps) {
  return (
    <div className={`mobile-screen px-4 pt-4 ${className}`}>
      {children}
    </div>
  )
}
