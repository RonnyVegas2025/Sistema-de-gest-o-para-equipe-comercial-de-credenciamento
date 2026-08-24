import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth/session'
import { Card, Alert } from '@/components/ui'
import { TrocarSenhaForm } from './trocar-senha-form'

export const metadata: Metadata = { title: 'Trocar senha' }

/**
 * Troca obrigatória de senha. Fica FORA do grupo (app) de propósito: sem o
 * shell de navegação, para que o usuário com must_change_password só possa
 * concluir a troca. O middleware garante a sessão; requireProfile aqui passa
 * com allowPasswordChange para não entrar em loop de redirecionamento.
 */
export default async function TrocarSenhaPage() {
  const profile = await requireProfile({ allowPasswordChange: true })

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <Card title="Defina sua senha">
          <div className="flex flex-col gap-4">
            {profile.must_change_password ? (
              <Alert variant="info">
                Por segurança, defina uma nova senha para continuar.
              </Alert>
            ) : null}
            <TrocarSenhaForm />
          </div>
        </Card>
      </div>
    </div>
  )
}
