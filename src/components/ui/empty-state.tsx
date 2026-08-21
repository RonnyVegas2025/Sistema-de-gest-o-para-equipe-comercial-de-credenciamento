import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type EmptyStateProps = {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

/** Estado vazio de listas e telas sem dados. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-muted px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-muted">{icon}</div> : null}
      <p className="font-display text-base text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-ink-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
