import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Troca o código do link de e-mail (recuperação de senha) por uma sessão e
 * segue para o destino. Falhando, volta ao login com aviso.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/nova-senha'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?reason=auth_error`)
}
