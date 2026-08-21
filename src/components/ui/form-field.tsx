import { cloneElement, type ReactElement } from 'react'
import { cn } from '@/lib/cn'
import { Label } from './label'
import { FieldError } from './field-error'

type ControlAria = {
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export type FormFieldProps = {
  id: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  /** Um único controle (Input, Select, etc.). Recebe id e aria-* injetados. */
  children: ReactElement
}

/**
 * Compõe rótulo, controle, dica e erro, fazendo a ligação de acessibilidade:
 * o controle recebe id, aria-invalid e aria-describedby corretos.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = cloneElement(children as ReactElement<ControlAria>, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  })

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      ) : null}
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-ink-secondary">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  )
}
