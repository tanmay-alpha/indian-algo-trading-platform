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
          "relative w-full max-h-[85vh] bg-[#090D14] border-t border-white/[0.08] rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden pb-4 animate-in slide-in-from-bottom duration-200",
          className
        )}
      >
        {/* Notch */}
        <div className="w-12 h-1 bg-white/[0.15] rounded-full mx-auto my-3 shrink-0" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-white/[0.04]">
          <h3 className="text-sm font-bold text-text tracking-wide">{title}</h3>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-text-dim hover:bg-white/[0.1] active:scale-95 transition-all"
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
