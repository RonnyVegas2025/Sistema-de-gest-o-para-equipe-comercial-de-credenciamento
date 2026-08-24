import type { Metadata } from 'next'
import { ShieldAlert } from 'lucide-react'
import { requireProfile } from '@/lib/auth/session'
import { listUsers, type UsuarioLinha } from '@/lib/users/queries'
import { canRead } from '@/lib/permissions/can'
import { Alert, EmptyState, PageHeader } from '@/components/ui'
import { UsuariosClient } from './usuarios-client'

export const metadata: Metadata = { title: 'Usuários' }

// A leitura é por sessão: cachear a lista serviria a lista de outro usuário.
export const dynamic = 'force-dynamic'

/**
 * Administração de usuários — o chamador da Edge Function `admin-create-user`.
 *
 * A consulta vive em `@/lib/users/queries` — ver lá por que a listagem lê
 * `profiles` direto e não a view `user_directory`.
 *
 * Os cinco estados: `loading` está em `loading.tsx`; `forbidden`, `error`,
 * `empty` e `success` estão abaixo. **`forbidden` não é redirect:** mandar o
 * usuário para `/inicio` sem dizer nada transforma falta de permissão em
 * comportamento inexplicável de menu.
 */
export default async function UsuariosPage() {
  const profile = await requireProfile()

  if (!canRead(profile.role, 'usuarios')) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Usuários" />
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="Você não tem acesso a esta área"
          description="A administração de usuários é restrita ao perfil Administrador. Se precisa de acesso, procure um administrador."
        />
      </div>
    )
  }

  let usuarios: UsuarioLinha[]
  try {
    usuarios = await listUsers()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Usuários" />
        <Alert variant="danger" title="Não foi possível carregar os usuários">
          Tente novamente em instantes. Se persistir, procure o responsável
          técnico.
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários"
        description="Criação de acesso e senha temporária. O primeiro acesso exige troca de senha."
      />
      <UsuariosClient usuarios={usuarios} meuId={profile.id} />
    </div>
  )
}
