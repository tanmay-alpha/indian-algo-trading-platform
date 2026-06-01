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
    <>
      <style>{`
        @keyframes skeleton-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.03) 25%,
            rgba(255, 255, 255, 0.08) 37%,
            rgba(255, 255, 255, 0.03) 63%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite linear;
        }
      `}</style>
      <div
        className={cn(
          'animate-skeleton-shimmer border border-white/5',
          circle ? 'rounded-full' : 'rounded-lg',
          width,
          height,
          className
        )}
      />
    </>
  )
}
