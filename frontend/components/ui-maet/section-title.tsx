'use client'

import { ReactNode } from 'react'

interface SectionTitleProps {
  title: string
  action?: ReactNode
}

export function SectionTitle({ title, action }: SectionTitleProps) {
  return (
    <div className="flex items-center justify-between mb-3 mt-1 px-1 shrink-0">
      <h2 className="text-xs font-bold text-text-dim uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  )
}
