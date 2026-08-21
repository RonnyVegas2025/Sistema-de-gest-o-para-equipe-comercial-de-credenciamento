import { redirect } from 'next/navigation'

/**
 * Rota raiz. Agora que `/inicio` existe (etapa 4), redireciona para lá. Usuário
 * sem sessão é levado ao login pelo middleware antes de chegar em `/inicio`.
 */
export default function RootPage() {
  redirect('/inicio')
}
