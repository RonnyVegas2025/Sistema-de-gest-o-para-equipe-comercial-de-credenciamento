import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode
  actions?: ReactNode
}

/** Card branco, borda de 1px, raio 10px e sombra quase imperceptível
 * (IDENTIDADE_VISUAL §4). Sem card dentro de card. */
export function Card({
  title,
  actions,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface shadow-card',
        className,
      )}
      {...props}
    >
      {title || actions ? (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          {title ? (
            <h2 className="font-display text-base text-ink">{title}</h2>
          ) : (
            <span />
          )}
          {actions}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  )
}
