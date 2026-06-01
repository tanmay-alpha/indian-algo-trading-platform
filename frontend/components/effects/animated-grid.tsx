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
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 40%, transparent 100%)',
        }}
      />
    </div>
  )
}
