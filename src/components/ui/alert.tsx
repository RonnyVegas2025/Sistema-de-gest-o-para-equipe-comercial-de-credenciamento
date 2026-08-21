import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant
  title?: ReactNode
}

const VARIANTS: Record<AlertVariant, string> = {
  info: 'bg-state-info-bg text-state-info-fg',
  success: 'bg-state-success-bg text-state-success-fg',
  warning: 'bg-state-warning-bg text-state-warning-fg',
  danger: 'bg-state-danger-bg text-state-danger-fg',
}

export function Alert({
  variant = 'info',
  title,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('rounded px-4 py-3 text-sm', VARIANTS[variant], className)}
      {...props}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
    </div>
  )
}
