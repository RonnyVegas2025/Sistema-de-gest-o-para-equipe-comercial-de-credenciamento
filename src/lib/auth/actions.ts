'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'
import {
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
} from '@/lib/validations/auth'

/** Mensagem única de credencial, sem revelar se o e-mail existe. */
const GENERIC_LOGIN_ERROR = 'E-mail ou senha não conferem'

export type LoginState = { error?: string; email?: string }

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : ''
  // Só caminhos internos, para não virar open redirect.
  return value.startsWith('/') && !value.startsWith('//') ? value : '/inicio'
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
  const parsed = loginSchema.safeParse({
    email,
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: GENERIC_LOGIN_ERROR, email }
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    return { error: GENERIC_LOGIN_ERROR, email }
  }

  // Conta desativada não entra, mesmo com senha correta.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', data.user.id)
    .single()

  if (profile && !profile.is_active) {
    await supabase.auth.signOut()
    return { error: 'Acesso desativado. Procure um administrador.', email }
  }

  redirect(safeNext(formData.get('next')))
}

export type ForgotPasswordState = { message?: string }

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  // Resposta idêntica exista ou não o e-mail.
  const genericMessage =
    'Se o e-mail estiver cadastrado, enviamos as instruções de recuperação.'

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (parsed.success) {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/nova-senha`,
    })
  }

  return { message: genericMessage }
}

export type NewPasswordState = { error?: string }

export async function updatePassword(
  _prevState: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return {
      error: 'Não foi possível atualizar a senha. Solicite um novo link.',
    }
  }

  redirect('/login?reason=password_updated')
}

/**
 * Troca obrigatória de senha (barreira de primeiro acesso / pós-regeneração,
 * DE-017/DE-019). Diferente de updatePassword, roda com a sessão normal do
 * usuário (não a de recuperação) e desliga must_change_password ao concluir.
 */
export async function changeOwnPassword(
  _prevState: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) {
    return { error: 'Não foi possível atualizar a senha. Tente novamente.' }
  }

  // Desliga o flag: a policy profiles_update permite o usuário editar a própria
  // linha e o trigger prevent_profile_tampering não bloqueia esta coluna.
  await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id)

  redirect('/inicio')
}

export async function logout(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
