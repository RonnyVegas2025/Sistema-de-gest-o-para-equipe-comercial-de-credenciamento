import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Classe base compartilhada por Input, Select, Textarea e os campos com
 * máscara, para todos terem a mesma borda, altura e estado de foco/erro. */
export const fieldBaseClass = cn(
  'w-full rounded border border-line-field bg-surface px-3 text-ink',
  'placeholder:text-ink-placeholder',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  'aria-[invalid=true]:border-state-danger-fg',
)

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(fieldBaseClass, 'h-11 lg:h-10', className)}
      {...props}
    />
  )
})
