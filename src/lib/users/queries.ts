import { createClient } from '@/lib/supabase/server'
import { rows } from '@/lib/supabase/query'
import type { AppRole } from '@/types/database'

export type UsuarioLinha = {
  id: string
  full_name: string
  email: string
  role: AppRole
  is_active: boolean
  must_change_password: boolean
}

/**
 * Lista de usuários para a tela de administração.
 *
 * Fica aqui, e não dentro do Server Component, por causa da regra de lint que
 * proíbe `@/lib/supabase/server` fora de `src/lib/**` — a regra existe para que
 * um componente client não puxe o cliente de servidor por engano. Afrouxá-la
 * para `src/app/**` cobriria também os componentes com `'use client'`, que é
 * exatamente o que ela protege.
 *
 * Hoje a barreira é só o lint. O pacote `server-only` transformaria isso em
 * erro de build, mas instalá-lo exige decisão registrada — fica proposto, não
 * feito.
 *
 * **Lê `profiles` direto, não a view `user_directory`.** A view devolve só `id`
 * e `full_name`, e existe para preencher select de vínculo sem expor o
 * diretório (D-032); alargá-la para servir esta tela desfaria a decisão. A RLS
 * de `profiles` já garante que apenas administrador lê todas as linhas
 * (`RLS_PERMISSOES.md` §5.1) — usar a barreira que existe é melhor que criar
 * uma segunda.
 *
 * `rows()` propaga o erro em vez de mascarar como lista vazia: relação
 * inexistente (migration não aplicada) tem de estourar, não virar "nenhum
 * usuário". RLS negando devolve conjunto vazio SEM erro, e continua `[]`.
 */
export async function listUsers(): Promise<UsuarioLinha[]> {
  const supabase = createClient()
  return rows(
    await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, must_change_password')
      .order('full_name'),
  )
}
