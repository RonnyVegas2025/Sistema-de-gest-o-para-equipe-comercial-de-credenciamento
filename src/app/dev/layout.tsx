import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'

// Avaliado a cada request: os gates NÃO podem ser assados no build. Sem isto,
// uma geração estática rodaria a checagem uma vez e o gate viraria decoração.
export const dynamic = 'force-dynamic'

/**
 * Guarda do segmento /dev — cobre o catálogo e qualquer rota futura sob /dev,
 * para nenhuma nascer pública.
 *
 * Duas barreiras:
 *
 * 1. Ambiente, fail-closed: só renderiza em preview/development. Qualquer outro
 *    valor de VERCEL_ENV — inclusive ausente — cai em notFound(), que é o "404
 *    em produção" da etapa 2.
 * 2. Sessão e perfil administrador (etapa 4). O middleware libera /dev na borda
 *    de propósito, para o 404 de produção responder limpo sem exigir login;
 *    esta é a barreira real.
 *
 * O que sustenta a barreira 2 é o saneamento de D-029: como o middleware remove
 * `x-user-profile` em TODA requisição — e não só nas de rota protegida —, o
 * `requireProfile()` abaixo não pode ser satisfeito por um header forjado, ainda
 * que /dev seja rota pública no middleware. É exatamente o caminho que o sistema
 * de origem deixa aberto.
 */
export default async function DevLayout({ children }: { children: ReactNode }) {
  const env = process.env.VERCEL_ENV
  if (env !== 'preview' && env !== 'development') {
    notFound()
  }

  const profile = await requireProfile()
  if (profile.role !== 'administrador') {
    redirect('/inicio')
  }

  return <>{children}</>
}
