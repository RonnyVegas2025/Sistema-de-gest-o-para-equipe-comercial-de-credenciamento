import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { fieldBaseClass } from './input'

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Campo de data. Usa o controle nativo (type="date"), com valor em ISO
 * (yyyy-mm-dd) e o seletor do navegador — acessível e localizado sem máscara
 * manual. A exibição formatada em pt-BR fica por conta de lib/format na leitura.
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="date"
        className={cn(fieldBaseClass, 'h-11 lg:h-10', className)}
        {...props}
      />
    )
  },
)
