'use client'

import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { fieldBaseClass } from './input'

export type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
>

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(fieldBaseClass, 'h-11 pr-16 lg:h-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 text-sm text-brand-600 hover:underline"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    )
  },
)
