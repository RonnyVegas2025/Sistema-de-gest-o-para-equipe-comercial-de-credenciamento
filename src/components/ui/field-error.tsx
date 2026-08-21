import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type FieldErrorProps = HTMLAttributes<HTMLParagraphElement>

/** Mensagem de erro de campo. Deve receber um id referenciado por
 * aria-describedby do controle correspondente. */
export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (!children) return null
  return (
    <p
      role="alert"
      className={cn('text-sm text-state-danger-fg', className)}
      {...props}
    >
      {children}
    </p>
  )
}
