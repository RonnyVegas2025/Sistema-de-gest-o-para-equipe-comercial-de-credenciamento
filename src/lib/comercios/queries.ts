import { createClient } from '@/lib/supabase/server'
import { countOf, rows } from '@/lib/supabase/query'
import type { AppRole } from '@/types/database'

/**
 * Consultas da página "Novos Comércios".
 *
 * Fica em `src/lib/**` pela regra de lint que proíbe `@/lib/supabase/server`
 * fora dali — ela existe para que um componente `'use client'` não puxe o
 * cliente de servidor por engano, e afrouxá-la para `src/app/**` cobriria
 * exatamente o que ela protege. Mesmo motivo de `src/lib/users/queries.ts`.
 *
 * ===========================================================================
 * TUDO SAI DE `crm_merchant_origin_status` (migration 0015)
 *
 * A view é a relação única: lista e contadores leem dela, sob a mesma RLS. Não é
 * conveniência — é a invariante que impede o indicador de exceção de mentir.
 *
 * O erro que ela evita: `companies` tem leitura AMPLA (§5.2), então um comércio
 * fora do escopo do consultor aparece na tabela de empresas enquanto a demanda
 * dele fica invisível. Contando "comércio sem linha em demandas" contra
 * `companies`, quase toda a base viraria exceção para um consultor — e erraria
 * para cima, que é a direção que ninguém desconfia num indicador de pendência.
 * O resultado não seria um alarme: seria parar de olhar o número.
 *
 * A view recorta porque tem `security_invoker = true`, e isso é exercitado em
 * `supabase/dev/comportamento/0015_view.sql` — não deduzido (D-045).
 */

export type ComercioLinha = {
  relationshipId: string
  companyId: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string | null
  municipio: string | null
  uf: string | null
  responsavelId: string | null
  responsavelNome: string | null
  temOrigem: boolean
  cadastradoEm: string
}

/**
 * Contador de comércios sem responsável.
 *
 * União discriminada, e não `number` com zero: para um consultor as linhas sem
 * responsável são **invisíveis** pela RLS, então a contagem dele seria sempre 0
 * — e um "0 sem responsável" na tela afirmaria que não existe nenhum, quando o
 * certo é que ele não enxerga nenhum. Zero legítimo e zero por recorte são
 * estados diferentes, e o tipo não deixa confundi-los.
 *
 * Distribuir é ação de gestão (`RLS_PERMISSOES.md` §5.3); para quem não
 * distribui, o indicador não se aplica — e não se aplica é diferente de vazio.
 */
export type ContadorSemResponsavel =
  { seAplica: true; valor: number } | { seAplica: false }

export type ContadoresComercios = {
  total: number
  semOrigem: number
  semResponsavel: ContadorSemResponsavel
}

export type FiltrosComercios = {
  busca?: string
  /** `true` mostra só os sem origem. O contador NÃO muda com isto. */
  apenasSemOrigem?: boolean
  pagina?: number
  porPagina?: number
}

const PADRAO_POR_PAGINA = 25
const COLUNAS =
  'relationship_id, company_id, legal_name, trade_name, cnpj, municipio, uf, responsible_seller_id, tem_origem, company_created_at'

const GESTAO: readonly AppRole[] = ['administrador', 'gestor_adm']

/**
 * Contadores do topo da página.
 *
 * **Nenhum filtro da interface entra aqui, e é de propósito.** Filtrar não pode
 * mudar o número: é isso que separa um indicador monitorado de um filtro que
 * alguém precisa lembrar de aplicar (D-042, decisão 6). O contador responde
 * "quantos existem no seu escopo", não "quantos a tela está mostrando".
 *
 * `head: true` traz só a contagem — as três chamadas não transferem linha
 * nenhuma. Todas contra a mesma view, então o recorte é o mesmo da lista.
 */
export async function contarComercios(
  papel: AppRole,
): Promise<ContadoresComercios> {
  const supabase = createClient()
  const base = () =>
    supabase
      .from('crm_merchant_origin_status')
      .select('relationship_id', { count: 'exact', head: true })

  const [total, semOrigem] = await Promise.all([
    base(),
    base().eq('tem_origem', false),
  ])

  const semResponsavel: ContadorSemResponsavel = GESTAO.includes(papel)
    ? {
        seAplica: true,
        valor: countOf(await base().is('responsible_seller_id', null)),
      }
    : { seAplica: false }

  return {
    total: countOf(total),
    semOrigem: countOf(semOrigem),
    semResponsavel,
  }
}

/**
 * Página da lista.
 *
 * O nome do responsável vem de uma segunda consulta a `sellers` em vez de um
 * embed: a view não o expõe, e alargá-la para carregar nome de exibição
 * misturaria projeção de recorte com projeção de apresentação. `sellers` tem
 * leitura ampla (§5.2), então isto não amplia escopo nenhum — mas as linhas
 * exibidas continuam sendo só as que a view devolveu.
 */
export async function listarComercios(
  filtros: FiltrosComercios = {},
): Promise<{ linhas: ComercioLinha[]; totalFiltrado: number }> {
  const supabase = createClient()
  const pagina = Math.max(1, filtros.pagina ?? 1)
  const porPagina = Math.max(1, filtros.porPagina ?? PADRAO_POR_PAGINA)
  const de = (pagina - 1) * porPagina

  let q = supabase
    .from('crm_merchant_origin_status')
    .select(COLUNAS, { count: 'exact' })
    .order('company_created_at', { ascending: false })
    .range(de, de + porPagina - 1)

  if (filtros.apenasSemOrigem) q = q.eq('tem_origem', false)

  const busca = filtros.busca?.trim()
  if (busca) {
    // `or` do PostgREST: vírgula separa alternativas. O termo é escapado para
    // que vírgula ou parêntese digitados não sejam lidos como sintaxe do filtro.
    const termo = busca.replace(/[,()]/g, ' ')
    q = q.or(
      `legal_name.ilike.%${termo}%,trade_name.ilike.%${termo}%,cnpj.ilike.%${termo}%`,
    )
  }

  const resultado = await q
  const linhas = rows(resultado)

  const responsaveis = new Map<string, string>()
  const ids = [
    ...new Set(
      linhas
        .map((l) => l.responsible_seller_id)
        .filter((id): id is string => id !== null),
    ),
  ]
  if (ids.length > 0) {
    const nomes = rows(
      await supabase.from('sellers').select('id, full_name').in('id', ids),
    )
    for (const s of nomes) responsaveis.set(s.id, s.full_name)
  }

  return {
    totalFiltrado: resultado.count ?? 0,
    linhas: linhas.map((l) => ({
      relationshipId: l.relationship_id,
      companyId: l.company_id,
      razaoSocial: l.legal_name,
      nomeFantasia: l.trade_name,
      cnpj: l.cnpj,
      municipio: l.municipio,
      uf: l.uf,
      responsavelId: l.responsible_seller_id,
      responsavelNome: l.responsible_seller_id
        ? (responsaveis.get(l.responsible_seller_id) ?? null)
        : null,
      temOrigem: l.tem_origem,
      cadastradoEm: l.company_created_at,
    })),
  }
}

/** Catálogo de origens ativas, para o formulário. */
export async function listarOrigens() {
  const supabase = createClient()
  return rows(
    await supabase
      .from('crm_demand_origins')
      .select('id, match_key, name, requires_client_company')
      .eq('status', 'ativo')
      .order('name'),
  )
}

/**
 * O usuário tem vínculo de consultor?
 *
 * Existe para separar dois zeros que a tela não distingue sozinha
 * (`RLS_PERMISSOES.md` §4.4): consultor **sem linha em `sellers`** enxerga zero
 * registros — comportamento correto da RLS — e isso é idêntico a "ainda não há
 * comércios cadastrados". Sem estado dedicado, vira chamado de suporte
 * recorrente, e o usuário conclui que o sistema está quebrado.
 *
 * `sellers` tem leitura ampla (§5.2), então a consulta não depende de escopo —
 * e é justamente por isso que ela funciona: um consultor sem vínculo consegue
 * ler a tabela e confirmar que não está lá.
 */
export async function possuiVinculoDeConsultor(
  profileId: string,
): Promise<boolean> {
  const supabase = createClient()
  return (
    countOf(
      await supabase
        .from('sellers')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('status', 'ativo'),
    ) > 0
  )
}
