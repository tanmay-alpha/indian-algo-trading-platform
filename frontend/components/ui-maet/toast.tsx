'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { cn, uid } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  body?: string
}

interface ToastContextValue {
  pushToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = uid('toast-')
    setToasts((current) => [{ ...toast, id }, ...current].slice(0, 4))
    window.setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+12px)] z-[120] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[360px]">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    return {
      pushToast: () => undefined,
    }
  }
  return context
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => undefined, [])
  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: TriangleAlert,
    info: Info,
  }[toast.type]

  const toneClass = {
    success: 'border-maet-green/40 text-maet-green',
    error: 'border-maet-red/40 text-maet-red',
    warning: 'border-maet-amber/40 text-maet-amber',
    info: 'border-maet-blue/40 text-maet-blue',
  }[toast.type]

  return (
    <div className={cn('pointer-events-auto slide-in-bottom rounded-card border bg-maet-surface p-3 shadow-raised', toneClass)} role="status">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-maet-text">{toast.title}</div>
          {toast.body && <div className="mt-0.5 text-xs leading-relaxed text-maet-text-secondary">{toast.body}</div>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-maet-text-muted hover:bg-maet-elevated hover:text-maet-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
