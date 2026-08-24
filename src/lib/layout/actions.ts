'use server'

import { cookies } from 'next/headers'
import { SIDEBAR_COOKIE } from './constants'

/** Persiste a preferência de menu recolhido por um ano. Lida no servidor pelo
 * app-shell, para o menu já renderizar no estado certo. */
export async function persistSidebarCollapsed(
  collapsed: boolean,
): Promise<void> {
  cookies().set(SIDEBAR_COOKIE, collapsed ? '1' : '0', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
