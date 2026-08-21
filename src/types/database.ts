/**
 * PROVISÓRIO — não editar como se fosse definitivo.
 *
 * Este arquivo é normalmente **gerado**: `npm run db:types` o produz a partir do
 * schema real. Aqui ele está escrito à mão porque a etapa 4 (autenticação)
 * precede a etapa 6 (migrations), e o middleware, a sessão, os papéis e a
 * navegação não compilam sem os tipos de `profiles`.
 *
 * A forma abaixo segue `docs/MODELO_DADOS.md` §2.1 e §1.1 — é o que a migration
 * `0001` vai criar.
 *
 * SUBSTITUIÇÃO AGENDADA: na etapa 6, imediatamente após aplicar a `0001`, rodar
 *
 *     npm run db:types && npm run verify
 *
 * A saída da máquina sobrescreve este arquivo por inteiro. Se a forma escrita
 * aqui divergir do schema real, o `typecheck` acusa nesse momento — que é o
 * ponto do procedimento: a divergência aparece alto, num instante definido, e
 * não silenciosamente meses depois.
 *
 * Enquanto este cabeçalho existir, o arquivo é provisório.
 */

export type AppRole =
  | 'administrador'
  | 'gestor_adm'
  | 'analista_adm'
  | 'comercial'
  | 'financeiro'
  | 'auditoria'

export type EntityStatus = 'ativo' | 'inativo'

/**
 * `must_change_password` nasce `true` por decisão do CRM — usuário criado por
 * administrador recebe senha temporária e troca no primeiro acesso. O sistema
 * de origem usa default `false`; a divergência é deliberada e vale para a
 * migration `0001`.
 */
export type ProfileRow = {
  id: string
  full_name: string
  email: string
  role: AppRole
  is_active: boolean
  must_change_password: boolean
  created_at: string
  updated_at: string
}

export type ProfileInsert = {
  id: string
  full_name: string
  email: string
  role?: AppRole
  is_active?: boolean
  must_change_password?: boolean
  created_at?: string
  updated_at?: string
}

export type ProfileUpdate = Partial<ProfileInsert>

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      app_role: AppRole
      entity_status: EntityStatus
    }
    CompositeTypes: Record<never, never>
  }
}
