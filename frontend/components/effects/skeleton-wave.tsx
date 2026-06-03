'use client'

import { cn } from '@/lib/utils'

export function SkeletonWave({ className }: { className?: string }) {
  return <div className={cn('shimmer-surface rounded-md', className)} />
}
