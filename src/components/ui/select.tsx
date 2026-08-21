import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { fieldBaseClass } from './input'

export type SelectOption = { value: string; label: string }

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options?: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { className, options, placeholder, children, ...props },
    ref,
  ) {
    return (
      <select
        ref={ref}
        className={cn(fieldBaseClass, 'h-11 pr-8 lg:h-10', className)}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
    )
  },
)
