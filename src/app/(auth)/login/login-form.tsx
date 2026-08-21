'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { login, type LoginState } from '@/lib/auth/actions'
import {
  Button,
  Input,
  PasswordInput,
  Label,
  FieldError,
  Alert,
} from '@/components/ui'

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} className="w-full">
      Entrar
    </Button>
  )
}

/** Formulário de login. Validação no cliente e no servidor; erro genérico que
 * preserva o e-mail digitado; botão em carregamento sem duplo submit. */
export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction] = useFormState(login, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {notice ? <Alert variant="info">{notice}</Alert> : null}

      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? 'login-error' : undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha">Senha</Label>
        <PasswordInput
          id="senha"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? 'login-error' : undefined}
        />
      </div>

      {state.error ? (
        <FieldError id="login-error">{state.error}</FieldError>
      ) : null}

      <SubmitButton />

      <Link
        href="/esqueci-senha"
        className="text-center text-sm text-brand-600 hover:underline"
      >
        Esqueci minha senha
      </Link>
    </form>
  )
}
