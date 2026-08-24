import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  /** Quando presente, mostra o botão de remover (ex.: filtro ativo). */
  onRemove?: () => void
  removeLabel?: string
}

export function Chip({
  className,
  children,
  onRemove,
  removeLabel = 'Remover',
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border border-line bg-surface-muted px-2 py-1 text-xs text-ink-secondary',
        className,
      )}
      {...props}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-ink"
          aria-label={removeLabel}
        >
          ×
        </button>
      ) : null}
    </span>
  )
}
