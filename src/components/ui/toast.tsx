'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

type ToastItem = { id: number; message: string; variant: ToastVariant }

type ToastContextValue = {
  notify: (message: string, variant?: ToastVariant) => void
}

const VARIANTS: Record<ToastVariant, string> = {
  info: 'bg-state-info-bg text-state-info-fg',
  success: 'bg-state-success-bg text-state-success-fg',
  warning: 'bg-state-warning-bg text-state-warning-fg',
  danger: 'bg-state-danger-bg text-state-danger-fg',
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Contador de ids em módulo — evita Date.now()/Math.random() na renderização.
let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      counter += 1
      const id = counter
      setToasts((current) => [...current, { id, message, variant }])
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, 4000)
    },
    [],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        role="region"
        aria-label="Notificações"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'rounded px-4 py-2 text-sm shadow-overlay',
              VARIANTS[toast.variant],
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>.')
  }
  return context
}
