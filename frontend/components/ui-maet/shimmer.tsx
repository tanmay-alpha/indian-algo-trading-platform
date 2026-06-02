'use client'

import { ShimmerSkeleton } from '@/components/effects/shimmer-skeleton'

export function Shimmer({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <ShimmerSkeleton width={width} height={height} />
}
