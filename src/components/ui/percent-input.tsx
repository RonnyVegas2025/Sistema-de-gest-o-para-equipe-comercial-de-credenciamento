'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { fieldBaseClass } from './input'

const formatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function format(value: number | null): string {
  if (value === null || Number.isNaN(value)) return ''
  return formatter.format(value)
}

export type PercentInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Percentual como número (12.5 = 12,5%). Nunca string formatada. */
  value: number | null
  onValueChange: (value: number | null) => void
}

/** Campo de percentual pt-BR. Valor numérico no estado, com duas casas. */
export const PercentInput = forwardRef<HTMLInputElement, PercentInputProps>(
  function PercentInput({ value, onValueChange, className, ...props }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={format(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '')
            onValueChange(digits ? Number(digits) / 100 : null)
          }}
          className={cn(
            'vg-numeric h-11 pr-9 text-right lg:h-10',
            fieldBaseClass,
            className,
          )}
          {...props}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
        >
          %
        </span>
      </div>
    )
  },
)
