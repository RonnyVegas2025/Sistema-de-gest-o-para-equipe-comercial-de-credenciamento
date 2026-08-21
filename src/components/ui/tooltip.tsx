import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type TooltipProps = {
  label: string
  children: ReactNode
  className?: string
}

/**
 * Tooltip por CSS: aparece no hover e no foco do gatilho (group-focus-within),
 * sem JS. O gatilho precisa ser focável para o acesso por teclado.
 */
export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap',
          'rounded-sm bg-ink px-2 py-1 text-xs text-white opacity-0 shadow-raised transition-opacity',
          'group-focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        {label}
      </span>
    </span>
  )
}
