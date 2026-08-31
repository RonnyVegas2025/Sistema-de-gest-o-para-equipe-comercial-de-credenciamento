'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { canWrite } from '@/lib/permissions/can'
import { cadastrarComercioSchema } from '@/lib/validations/comercios'

/**
 * Server Actions da página "Novos Comércios".
 *
 * `canWrite` aqui é a segunda camada, não a barreira — a RLS é a fronteira real
 * (`companies_insert`, `crm_company_relationships_insert`,
 * `crm_demands_insert`). O gate existe para a tela responder `forbidden` em vez
 * de esperar um erro vindo do banco, nunca para autorizar coisa alguma.
 *
 * ===========================================================================
 * TRÊS INSERTS, E O BANCO NÃO OFERECE TRANSAÇÃO PELO PostgREST
 *
 * Cadastrar um comércio novo escreve em três relações: `companies`, o
 * relacionamento e a demanda. Pelo PostgREST cada uma é uma requisição, e não
 * há `BEGIN`/`COMMIT` — se a terceira falhar, as duas primeiras já estão
 * gravadas.
 *
 * **A ordem escolhida faz o estado parcial ser recuperável, não invisível.**
 * Empresa → relacionamento → demanda. Falhando a demanda, o que sobra é um
 * comércio SEM ORIGEM — que é exatamente a exceção que a página conta no topo,
 * visível por padrão. O usuário vê o registro na lista, contado como pendência,
 * e completa.
 *
 * A ordem inversa (demanda primeiro) é impossível: a demanda referencia a
 * empresa. Mas vale registrar por quê a escolhida é boa e não só necessária —
 * qualquer estado parcial aqui **aparece no indicador**, em vez de virar linha
 * órfã que ninguém procura.
 *
 * O que NÃO é aceitável é o inverso: gravar a demanda e perder o
 * relacionamento, deixando o comércio invisível ao consultor que o cadastrou.
 * Por isso o relacionamento vem antes.
 *
 * Compensação em caso de falha: nenhuma. Apagar o que já entrou exigiria
 * `DELETE`, e não existe policy de DELETE em lugar nenhum (D-023) — nem deveria
 * existir para isto. Estado parcial visível é melhor que remoção silenciosa.
 * ===========================================================================
 */

export type ComercioState =
  | { ok: true; companyId: string }
  | { ok: false; error: string; campos?: Record<string, string> }
  | Record<string, never>

const RECUSA_APLICACAO =
  'Seu perfil não permite cadastrar comércios. Recusado pela aplicação, antes de enviar.'

export async function cadastrarComercio(
  _anterior: ComercioState,
  formData: FormData,
): Promise<ComercioState> {
  const perfil = await requireProfile()
  if (!canWrite(perfil.role, 'estabelecimentos')) {
    return { ok: false, error: RECUSA_APLICACAO }
  }

  const bruto = {
    razaoSocial: String(formData.get('razaoSocial') ?? ''),
    nomeFantasia: String(formData.get('nomeFantasia') ?? ''),
    cnpj: String(formData.get('cnpj') ?? ''),
    municipio: String(formData.get('municipio') ?? ''),
    uf: String(formData.get('uf') ?? ''),
    origemId: String(formData.get('origemId') ?? ''),
    origemExigeEmpresa: formData.get('origemExigeEmpresa') === 'true',
    empresaDemandanteId: String(formData.get('empresaDemandanteId') ?? ''),
    responsavelId: String(formData.get('responsavelId') ?? ''),
    equipeId: String(formData.get('equipeId') ?? ''),
  }

  const parsed = cadastrarComercioSchema.safeParse(bruto)
  if (!parsed.success) {
    const campos: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const campo = issue.path[0]
      if (typeof campo === 'string' && !campos[campo])
        campos[campo] = issue.message
    }
    return { ok: false, error: 'Confira os campos destacados.', campos }
  }
  const dados = parsed.data
  const supabase = createClient()

  // 1 · empresa. `is_merchant` é o marcador de papel (D-041) — sem ele o
  // registro não entra na view e some da própria página que o criou.
  const { data: empresa, error: erroEmpresa } = await supabase
    .from('companies')
    .insert({
      legal_name: dados.razaoSocial,
      trade_name: dados.nomeFantasia || null,
      cnpj: dados.cnpj,
      municipio: dados.municipio || null,
      uf: dados.uf || null,
      is_merchant: true,
    })
    .select('id')
    .maybeSingle()

  if (erroEmpresa) return { ok: false, error: traduzir(erroEmpresa) }
  if (!empresa) {
    // INSERT aceito e linha não devolvida: a policy de SELECT filtrou o que
    // acabou de entrar. Não é erro de escrita, e dizer "falhou" seria mentira —
    // o registro existe.
    return {
      ok: false,
      error:
        'O comércio foi criado, mas não aparece no seu escopo. Peça à gestão para atribuir um responsável.',
    }
  }

  // 2 · relacionamento, ANTES da demanda: é ele que torna o comércio visível ao
  // consultor (recorte de 0013 e recorte transitivo de 0014).
  const { error: erroRel } = await supabase
    .from('crm_company_relationships')
    .insert({
      company_id: empresa.id,
      responsible_seller_id: dados.responsavelId || null,
      team_id: dados.equipeId || null,
      relationship_type: 'prospect',
      origin: 'novo_prospect',
    })
  if (erroRel) return { ok: false, error: traduzir(erroRel) }

  // 3 · demanda. Falhando aqui, sobra um comércio sem origem — contado no topo
  // da página, que é o desenho.
  const { error: erroDemanda } = await supabase
    .from('crm_accreditation_demands')
    .insert({
      merchant_company_id: empresa.id,
      origin_id: dados.origemId,
      client_company_id: dados.empresaDemandanteId || null,
      responsible_seller_id: dados.responsavelId || null,
      team_id: dados.equipeId || null,
    })
  if (erroDemanda) {
    return {
      ok: false,
      error: `${traduzir(erroDemanda)} O comércio foi cadastrado e aparece na lista como sem origem — complete por lá.`,
    }
  }

  revalidatePath('/comercios')
  return { ok: true, companyId: empresa.id }
}

/**
 * Erro do Postgres em texto de tela.
 *
 * As mensagens das triggers da 0014 já são escritas para o usuário final — três
 * recusas, três textos distintos, de propósito (D-042). Repassá-las é melhor
 * que substituir por um genérico: quem recebe precisa saber QUAL das três
 * violou, e é a mesma razão pela qual elas foram escritas assim.
 */
function traduzir(erro: { code?: string; message: string }): string {
  if (erro.code === '23505') return 'Já existe um comércio com este CNPJ.'
  if (erro.code === '42501')
    return 'Seu perfil não permite esta operação. Recusado pelo banco de dados.'
  if (erro.code === '23514' || erro.code === '23503') return erro.message
  return 'Não foi possível concluir o cadastro. Tente novamente.'
}
