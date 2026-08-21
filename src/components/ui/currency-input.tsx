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

export type CurrencyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Valor em reais como número. Nunca string formatada. */
  value: number | null
  onValueChange: (value: number | null) => void
}

/**
 * Campo monetário pt-BR. Mantém o valor como número no estado; a máscara é só
 * apresentação. Digitar acumula centavos da direita para a esquerda.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, onValueChange, className, ...props }, ref) {
    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
        >
          R$
        </span>
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
            'vg-numeric h-11 pl-9 text-right lg:h-10',
            fieldBaseClass,
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
