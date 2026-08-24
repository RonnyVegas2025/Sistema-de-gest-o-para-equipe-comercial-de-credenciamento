import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required, className, children, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn('text-sm font-medium text-ink-secondary', className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-state-danger-fg" aria-hidden>
          {' '}
          *
        </span>
      ) : null}
    </label>
  )
})
