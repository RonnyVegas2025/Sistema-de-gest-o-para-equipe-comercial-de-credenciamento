import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, label, id, ...props }, ref) {
    const input = (
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded-sm border border-line-strong text-brand-500',
          'accent-brand-500',
          className,
        )}
        {...props}
      />
    )

    if (!label) return input

    return (
      // O quadrado permanece 16 px por convenção visual; a área de toque de
      // 44 px vem do padding do rótulo em tela pequena (D-027).
      <label className="inline-flex min-h-11 items-center gap-2 py-3 text-sm text-ink lg:min-h-0 lg:py-0">
        {input}
        {label}
      </label>
    )
  },
)
