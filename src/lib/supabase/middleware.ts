import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Renova a sessão do Supabase em toda request e devolve o usuário atual e o
 * cliente já ligado aos cookies da request/response. O middleware raiz
 * (src/middleware.ts) usa o retorno para decidir redirecionamentos e checar
 * is_active.
 *
 * `sanitizedHeaders` são os headers da request já sem `x-user-profile`
 * (D-029). Recebê-los aqui — e não apenas no ramo de rota protegida — garante
 * que TODA resposta construída a partir desta função carregue headers limpos,
 * inclusive as dos caminhos que retornam cedo: rota pública, sem sessão,
 * redirect. Ver src/middleware.ts.
 *
 * Este arquivo não está na lista de exceção do no-restricted-imports, então
 * lê as variáveis públicas direto de process.env, não de @/lib/env.
 */
export async function updateSession(
  request: NextRequest,
  sanitizedHeaders: Headers,
) {
  let response = NextResponse.next({ request: { headers: sanitizedHeaders } })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request: { headers: sanitizedHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // Não inserir lógica entre criar o cliente e getUser(): a renovação do token
  // depende dessa chamada acontecer imediatamente.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user, supabase }
}
