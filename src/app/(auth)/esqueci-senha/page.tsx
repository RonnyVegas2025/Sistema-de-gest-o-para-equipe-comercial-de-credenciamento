'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from '@/lib/auth/actions'
import { Button, Card, Input, Label, Alert } from '@/components/ui'

const initialState: ForgotPasswordState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} className="w-full">
      Enviar instruções
    </Button>
  )
}

/** Recuperação de senha. A resposta é sempre a mesma, exista ou não o e-mail. */
export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(requestPasswordReset, initialState)

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <Card title="Recuperar senha">
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            {state.message ? (
              <Alert variant="info">{state.message}</Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
              />
            </div>
            <SubmitButton />
            <Link
              href="/login"
              className="text-center text-sm text-brand-600 hover:underline"
            >
              Voltar ao login
            </Link>
          </form>
        </Card>
      </div>
    </div>
  )
}
