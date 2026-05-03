'use client'

import { Notebook } from 'lucide-react'
import { EmptyState } from './empty-state'

export function JournalNotesPanel() {
  return (
    <EmptyState
      title="NOTES NOT PERSISTED"
      hint="Journal storage is not connected yet. This build keeps the drawer ready without saving data."
      icon={<Notebook className="w-6 h-6" />}
      compact
    />
  )
}
