import { z } from 'zod'
import { ALL_ROLES } from '@/lib/permissions/roles'
import type { AppRole } from '@/types/database'

/**
 * Criação de usuário. O mesmo schema valida o formulário e a Server Action —
 * a validação do cliente é conveniência; a do servidor é a que conta, e a
 * Edge Function revalida por conta própria antes de tocar na service role.
 *
 * `role` é validado contra `ALL_ROLES` e não contra `z.string()`: papel é enum
 * do banco, e aceitar texto livre aqui empurraria o erro para o INSERT, longe
 * da causa.
 */
export const criarUsuarioSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, 'Informe o nome completo')
    .max(120, 'Nome muito longo'),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido'),
  role: z.enum(ALL_ROLES as unknown as [AppRole, ...AppRole[]], {
    errorMap: () => ({ message: 'Selecione um perfil' }),
  }),
})

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>

/** Regeneração de senha: só o id, que precisa ser um uuid. */
export const regenerarSenhaSchema = z.object({
  userId: z.string().uuid('Usuário inválido'),
})

/**
 * Liga/desliga acesso. `ativo` é o **estado alvo**, não um pedido de inversão —
 * ver o comentário de `definirAcesso`. Vem do FormData como string, e só
 * `'true'` e `'false'` são aceitos: um `z.coerce.boolean()` aqui trataria
 * qualquer string não vazia como `true`, inclusive `'false'`.
 */
export const definirAcessoSchema = z.object({
  userId: z.string().uuid('Usuário inválido'),
  ativo: z.enum(['true', 'false']).transform((v) => v === 'true'),
})
