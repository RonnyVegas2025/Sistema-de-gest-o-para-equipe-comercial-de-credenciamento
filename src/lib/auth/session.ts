import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PROFILE_HEADER, decodeProfile } from '@/lib/auth/profile-header'
import type { ProfileRow } from '@/types/database'

/**
 * Perfil do usuário autenticado, ou null. Memoizado por request com cache() do
 * React, para não repetir a consulta quando layout e página o chamam.
 *
 * Caminho rápido: o middleware já validou a sessão (getUser) e leu `profiles`
 * na borda, anexando o perfil ao header da request. Aqui só lemos esse header —
 * sem SEGUNDO getUser e sem SEGUNDA consulta a profiles por navegação. O
 * fallback (consulta real) cobre contextos raros sem o header do middleware.
 */
export const getSessionProfile = cache(async (): Promise<ProfileRow | null> => {
  const raw = headers().get(PROFILE_HEADER)
  if (raw) {
    const profile = decodeProfile(raw)
    if (profile) return profile
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data ?? null
})

/**
 * Exige um perfil ativo. Sem sessão, vai para o login; desativado, vai para o
 * login com aviso. Usado no layout do grupo (app). O middleware já barra antes,
 * mas o layout é a segunda camada — não confie só no redirect da borda.
 *
 * `allowPasswordChange` deixa a própria /trocar-senha passar; nas demais rotas,
 * um perfil com must_change_password é redirecionado para lá (segunda camada da
 * barreira de troca obrigatória, DE-017/DE-019).
 */
export async function requireProfile({
  allowPasswordChange = false,
}: { allowPasswordChange?: boolean } = {}): Promise<ProfileRow> {
  const profile = await getSessionProfile()

  if (!profile) {
    redirect('/login')
  }
  if (!profile.is_active) {
    redirect('/login?reason=inactive')
  }
  if (profile.must_change_password && !allowPasswordChange) {
    redirect('/trocar-senha')
  }

  return profile
}
