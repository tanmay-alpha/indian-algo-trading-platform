'use client'

import { LoadingState } from './loading-state'
import { ErrorState } from './error-state'
import { EmptyState } from './empty-state'
import { ReactNode } from 'react'

interface DataStateProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyTitle?: string
  emptyHint?: string
  onRetry?: () => void
  loadingMessage?: string
  compact?: boolean
  children: ReactNode
}

export function DataState({
  loading = false,
  error = null,
  empty = false,
  emptyTitle = 'No data available',
  emptyHint,
  onRetry,
  loadingMessage,
  compact = false,
  children
}: DataStateProps) {
  if (loading) {
    return <LoadingState message={loadingMessage} compact={compact} />
  }
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} compact={compact} />
  }
  if (empty) {
    return <EmptyState title={emptyTitle} hint={emptyHint} compact={compact} />
  }
  return <>{children}</>
}
