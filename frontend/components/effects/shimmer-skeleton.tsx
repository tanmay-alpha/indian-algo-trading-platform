'use client'

import { cn } from '@/lib/utils'

interface ShimmerSkeletonProps {
  className?: string
  width?: string
  height?: string
  circle?: boolean
}

export function ShimmerSkeleton({
  className,
  width = 'w-full',
  height = 'h-4',
  circle = false,
}: ShimmerSkeletonProps) {
  return (
    <div
      className={cn(
        'shimmer-surface border border-maet-glass-border',
        circle ? 'rounded-full' : 'rounded-lg',
        width,
        height,
        className
      )}
    />
  )
}
