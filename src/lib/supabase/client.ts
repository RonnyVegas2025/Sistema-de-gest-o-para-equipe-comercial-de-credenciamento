import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Cliente Supabase para componentes client. Usa a chave publishable
 * (NEXT_PUBLIC_*), lida direto de process.env.
 *
 * Este arquivo não pode importar @/lib/env: env é módulo de servidor e a regra
 * no-restricted-imports bloqueia seu uso no cliente. Valores NEXT_PUBLIC_* são
 * inlinados pelo Next no bundle.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
