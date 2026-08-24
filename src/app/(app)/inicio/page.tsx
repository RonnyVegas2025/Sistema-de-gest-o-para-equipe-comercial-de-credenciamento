import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth/session'
import { roleLabel } from '@/lib/permissions/roles'
import { Card, PageHeader } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Início',
}

/**
 * Primeira tela autenticada. Nesta etapa ela confirma quem entrou e com qual
 * perfil — é o que torna verificável o caminho login → sessão → perfil validado
 * na borda → render.
 *
 * Os painéis de carteira, agenda e oportunidades entram nas sprints que os
 * tornam funcionais. Não antecipar aqui: KPI sem dado atrás é decoração que
 * ensina o usuário a ignorar a tela.
 */
export default async function InicioPage() {
  const profile = await requireProfile()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Olá, ${profile.full_name}`}
        description={`Você está conectado como ${roleLabel(profile.role)}.`}
      />

      <Card title="Estado do sistema">
        <p className="text-sm text-ink-secondary">
          A fundação está no ar: identidade visual, autenticação e barreira de
          sessão. Os módulos comerciais — carteira, oportunidades, atividades,
          agenda e visitas — entram nas próximas sprints.
        </p>
      </Card>
    </div>
  )
}
