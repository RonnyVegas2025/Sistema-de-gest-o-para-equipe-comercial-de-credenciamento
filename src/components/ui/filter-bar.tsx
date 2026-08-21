import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type FilterBarProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode
}

/** Barra de filtros de listagem: agrupa campos e ações numa faixa
 * responsiva sobre o card branco. */
export function FilterBar({
  className,
  children,
  actions,
  ...props
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3 shadow-card',
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-end gap-3">{children}</div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
