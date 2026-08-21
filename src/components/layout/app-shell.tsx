import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { requireProfile } from '@/lib/auth/session'
import { SIDEBAR_COOKIE } from '@/lib/layout/constants'
import { ShellChrome } from './shell-chrome'

/**
 * Composição do shell autenticado (menu + cabeçalho + conteúdo). Server
 * Component: exige o perfil e lê a preferência de recolhido do cookie, para o
 * menu já nascer no estado certo, sem piscar.
 *
 * O menu é filtrado por perfil dentro do ShellChrome (cliente): os itens
 * carregam componentes de ícone (lucide), que não podem cruzar a fronteira de
 * serialização server -> client. Por isso o server passa apenas o profile
 * (serializável) e o cliente chama navigationFor(profile.role).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireProfile()
  const collapsed = cookies().get(SIDEBAR_COOKIE)?.value === '1'

  return (
    <ShellChrome profile={profile} initialCollapsed={collapsed}>
      {children}
    </ShellChrome>
  )
}
