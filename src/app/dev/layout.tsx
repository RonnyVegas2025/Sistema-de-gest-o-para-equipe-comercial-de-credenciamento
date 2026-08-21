import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

// Avaliado a cada request: o gate de ambiente NÃO pode ser assado no build. Sem
// isto, uma geração estática rodaria a checagem uma vez e o gate viraria
// decoração.
export const dynamic = 'force-dynamic'

/**
 * Guarda do segmento /dev — cobre o catálogo e qualquer rota futura sob /dev,
 * para nenhuma nascer pública.
 *
 * Fail-closed: só renderiza em preview/development. Qualquer outro valor de
 * VERCEL_ENV — inclusive ausente/undefined — cai em notFound(), que é o "404 em
 * produção" exigido pela etapa 2.
 *
 * A segunda barreira (sessão + perfil administrador) entra na etapa 4, junto com
 * a autenticação. Até lá o gate é só de ambiente, e nenhuma rota sob /dev expõe
 * dado: o catálogo renderiza componentes com valores fictícios.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  const env = process.env.VERCEL_ENV
  if (env !== 'preview' && env !== 'development') {
    notFound()
  }

  return <>{children}</>
}
