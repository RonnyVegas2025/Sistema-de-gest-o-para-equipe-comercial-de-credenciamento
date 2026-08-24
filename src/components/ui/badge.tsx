import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** As sete variantes de estado da IDENTIDADE_VISUAL. Marca (info) identifica
 * navegação/estado informativo; rose e peach marcam subsídio (venda parcial e
 * retenção gratuita), localizáveis numa lista sem virar alarme. */
export type BadgeVariant =
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'rose' | 'peach'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const VARIANTS: Record<BadgeVariant, string> = {
  success: 'bg-state-success-bg text-state-success-fg',
  warning: 'bg-state-warning-bg text-state-warning-fg',
  danger: 'bg-state-danger-bg text-state-danger-fg',
  info: 'bg-state-info-bg text-state-info-fg',
  neutral: 'bg-state-neutral-bg text-state-neutral-fg',
  rose: 'bg-rose-50 text-rose-600',
  peach: 'bg-peach-50 text-peach-600',
}

export function Badge({
  variant = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
