'use client'

import { cn } from '@/lib/utils'
import { AmbientLight } from './ambient-light'
import { NoiseTexture } from './noise-texture'

export function PremiumBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-maet-base" />
      <div className="maet-subtle-grid absolute inset-0 opacity-45" />
      <AmbientLight tone="cyan" className="top-0" />
      <AmbientLight tone="blue" className="bottom-[-24%] rotate-180 opacity-60" />
      <NoiseTexture opacity={0.055} />
    </div>
  )
}
