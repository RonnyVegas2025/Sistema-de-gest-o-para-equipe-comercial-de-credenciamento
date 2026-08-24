'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { formatPhone, type PhoneKind } from '@/lib/format/phone'
import { fieldBaseClass } from './input'

export type PhoneInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  variant: PhoneKind
  /** Valor inicial (dígitos ou já formatado); é normalizado na exibição. */
  defaultValue?: string
}

/**
 * Campo de telefone com máscara na digitação. Aceita só dígitos e formata
 * conforme o tipo (celular/fixo). O valor enviado no submit é o texto
 * formatado; a Server Action grava só os dígitos (como o CNPJ).
 */
export function PhoneInput({
  variant,
  defaultValue = '',
  className,
  ...props
}: PhoneInputProps) {
  const [value, setValue] = useState(() => formatPhone(defaultValue, variant))

  return (
    <input
      type="tel"
      inputMode="numeric"
      value={value}
      onChange={(event) => setValue(formatPhone(event.target.value, variant))}
      placeholder={variant === 'celular' ? '(00) 00000-0000' : '(00) 0000-0000'}
      className={cn(fieldBaseClass, 'h-11 lg:h-10', className)}
      {...props}
    />
  )
}
