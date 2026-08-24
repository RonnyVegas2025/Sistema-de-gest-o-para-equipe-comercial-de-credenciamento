'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updatePassword, type NewPasswordState } from '@/lib/auth/actions'
import { Button, Card, PasswordInput, Label, FieldError } from '@/components/ui'

const initialState: NewPasswordState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} className="w-full">
      Salvar nova senha
    </Button>
  )
}

/** Conclusão da troca de senha, após o callback trocar o código por sessão. */
export default function NewPasswordPage() {
  const [state, formAction] = useFormState(updatePassword, initialState)

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <Card title="Definir nova senha">
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                aria-invalid={state.error ? true : undefined}
                aria-describedby={state.error ? 'password-error' : undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <PasswordInput
                id="confirm"
                name="confirm"
                autoComplete="new-password"
                required
                aria-invalid={state.error ? true : undefined}
                aria-describedby={state.error ? 'password-error' : undefined}
              />
            </div>
            {state.error ? (
              <FieldError id="password-error">{state.error}</FieldError>
            ) : null}
            <SubmitButton />
          </form>
        </Card>
      </div>
    </div>
  )
}
