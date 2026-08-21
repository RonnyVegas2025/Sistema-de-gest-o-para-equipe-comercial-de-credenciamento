import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { publicEnv } from '@/lib/env'

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave publishable com a sessão do usuário, guardada em cookies
 * httpOnly. Nunca usa a service role — a RLS é a fronteira de segurança.
 *
 * Este é um dos poucos arquivos autorizados a importar @/lib/env
 * (ver override em .eslintrc.json).
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Chamado a partir de um Server Component, onde a escrita de cookie
            // não é permitida. O middleware renova a sessão, então ignorar aqui
            // é seguro.
          }
        },
      },
    },
  )
}
