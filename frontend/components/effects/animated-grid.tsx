'use client'

import { cn } from '@/lib/utils'

interface AnimatedGridProps {
  className?: string
  opacity?: number
}

export function AnimatedGrid({ className, opacity = 0.15 }: AnimatedGridProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none -z-20 overflow-hidden',
        className
      )}
      style={{ opacity }}
    >
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'none',
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  )
}
