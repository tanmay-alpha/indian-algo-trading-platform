'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileActionSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function MobileActionSheet({ isOpen, onClose, title, children, className }: MobileActionSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={cn(
          "relative w-full max-h-[88dvh] border-t border-maet-glass-border bg-maet-bg-deep/82 rounded-t-3xl shadow-[0_-24px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl flex flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+12px)] animate-in slide-in-from-bottom duration-200",
          className
        )}
      >
        {/* Notch */}
        <div className="w-12 h-1 bg-white/[0.22] rounded-full mx-auto my-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-maet-glass-border">
          <h3 className="text-sm font-bold text-text tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close sheet"
            className="w-9 h-9 rounded-full bg-maet-glass-1 border border-maet-glass-border flex items-center justify-center text-text-dim hover:bg-maet-glass-2 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}
