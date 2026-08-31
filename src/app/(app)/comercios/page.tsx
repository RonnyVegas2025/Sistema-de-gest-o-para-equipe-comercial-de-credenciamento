import type { Metadata } from 'next'
import { Link2Off, ShieldAlert } from 'lucide-react'
import { requireProfile } from '@/lib/auth/session'
import { canRead } from '@/lib/permissions/can'
import {
  contarComercios,
  listarComercios,
  listarOrigens,
  possuiVinculoDeConsultor,
} from '@/lib/comercios/queries'
import { Alert, EmptyState, PageHeader } from '@/components/ui'
import { ComerciosClient } from './comercios-client'

export const metadata: Metadata = { title: 'Novos Comércios' }

// A leitura é por sessão: cachear serviria a lista de outro usuário.
export const dynamic = 'force-dynamic'

type Busca = { busca?: string; sem_origem?: string; pagina?: string }

/**
 * Página "Novos Comércios" (etapa 5c).
 *
 * SEIS estados, não cinco. Aos obrigatórios — `loading` em `loading.tsx`,
 * `forbidden`, `error`, `empty` e `success` aqui — soma-se **`sem vínculo`**,
 * que `RLS_PERMISSOES.md` §4.4 já previa: um consultor sem linha em `sellers`
 * enxerga zero registros por comportamento correto da RLS, e isso é
 * indistinguível de "ainda não há comércios". Sem estado próprio, o usuário
 * conclui que o sistema está quebrado — e o suporte recebe o mesmo chamado
 * todo mês.
 *
 * `forbidden` não é redirect: mandar para `/inicio` sem dizer nada transforma
 * falta de permissão em comportamento inexplicável de menu.
 */
export default async function ComerciosPage({
  searchParams,
}: {
  searchParams: Busca
}) {
  const perfil = await requireProfile()

  if (!canRead(perfil.role, 'estabelecimentos')) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Novos Comércios" />
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="Você não tem acesso a esta área"
          description="Se precisa acompanhar os comércios credenciados, procure um administrador."
        />
      </div>
    )
  }

  const filtros = {
    busca: searchParams.busca,
    apenasSemOrigem: searchParams.sem_origem === '1',
    pagina: Number(searchParams.pagina ?? '1') || 1,
  }

  let dados
  try {
    // Em paralelo: são leituras independentes, e a página não fica mais correta
    // esperando uma para começar a outra.
    const [contadores, lista, origens, temVinculo] = await Promise.all([
      contarComercios(perfil.role),
      listarComercios(filtros),
      listarOrigens(),
      possuiVinculoDeConsultor(perfil.id),
    ])
    dados = { contadores, lista, origens, temVinculo }
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Novos Comércios" />
        <Alert variant="danger" title="Não foi possível carregar os comércios">
          Tente novamente em instantes. Se persistir, procure o responsável
          técnico.
        </Alert>
      </div>
    )
  }

  const cabecalho = (
    <PageHeader
      title="Novos Comércios"
      description="Comércios credenciados e a origem da demanda que os trouxe."
    />
  )

  // Estado `sem vínculo`. Só se aplica a quem depende de escopo: a gestão lê
  // por papel, não por vínculo, e para ela zero significa zero de verdade.
  const dependeDeVinculo = !dados.contadores.semResponsavel.seAplica
  if (dependeDeVinculo && !dados.temVinculo) {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <EmptyState
          icon={<Link2Off className="h-6 w-6" />}
          title="Seu usuário ainda não está vinculado a um consultor"
          description="Por isso esta lista aparece vazia — não é falta de dados. Procure o seu gestor para que ele faça o vínculo."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}

      {/*
        O aviso vive na TELA, não só no documento da sprint. O modo de falhar
        desta entrega é específico e silencioso: a página fica pronta, todo
        mundo vê o vínculo aparecendo, e a pergunta da diretoria segue sem
        resposta com a sensação de que foi endereçada.
      */}
      <Alert variant="info" title="Esta tela mostra o elo, não a comparação">
        A pergunta &ldquo;o credenciamento se paga, e em quantos meses?&rdquo;
        precisa de quatro entradas: comissão paga, movimentação realizada, taxa
        administrativa e o vínculo com a demanda.{' '}
        <strong>Aqui está o vínculo.</strong> As outras três seguem em planilha,
        e a análise em paralelo é o que responde à diretoria nesse meio-tempo.
      </Alert>

      <ComerciosClient
        contadores={dados.contadores}
        linhas={dados.lista.linhas}
        totalFiltrado={dados.lista.totalFiltrado}
        origens={dados.origens}
        filtros={filtros}
        podeCadastrar={canRead(perfil.role, 'estabelecimentos')}
      />
    </div>
  )
}
