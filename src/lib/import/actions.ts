'use server'

import { createClient } from '@/lib/supabase/server'
import { canWrite } from '@/lib/permissions/can'
import type { AppRole } from '@/types/database'
import { runCommit, runPreview } from './engine'
import {
  consultoresSpec,
  diretoresSpec,
  equipesSpec,
  gestoresSpec,
  type EstruturaComercialKey,
} from './estrutura-comercial'
import type { CommitResult, PreviewResult } from './types'

/**
 * Server Actions da importação de estrutura comercial.
 *
 * O gate é `canWrite(role, 'importacoes')` — gestor e administrador (§3). A
 * fronteira real continua sendo a RLS: as policies das quatro tabelas já
 * restringem escrita a esses dois papéis, e este gate existe para a resposta
 * ser uma mensagem em vez de um erro de banco.
 *
 * NÃO HÁ TELA nesta sprint. A tela de importação entra na Sprint 3, junto com
 * as demais. Até lá a carga é executada por chamada direta destas funções,
 * por quem opera o projeto.
 */

/**
 * Rótulos por entidade, para a resposta de acesso negado. Separados das specs
 * de propósito: um mapa de specs heterogêneas apagaria a relação entre `TRaw` e
 * `TFinal` de cada uma, e o despacho abaixo é feito por `switch` justamente
 * para o TypeScript continuar enxergando o par certo — sem `as never`.
 */
const LABELS: Record<EstruturaComercialKey, string[]> = {
  diretores: diretoresSpec.columnLabels,
  gestores: gestoresSpec.columnLabels,
  equipes: equipesSpec.columnLabels,
  consultores: consultoresSpec.columnLabels,
}

async function callerRole(): Promise<AppRole | null> {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return data?.role ?? null
}

async function autorizado(): Promise<boolean> {
  const role = await callerRole()
  return Boolean(role && canWrite(role, 'importacoes'))
}

function negadoPreview(columns: string[]): PreviewResult {
  return {
    ok: false,
    headerError: 'Sem permissão para importar estrutura comercial.',
    columns,
    summary: { total: 0, criar: 0, atualizar: 0, erro: 0 },
    notices: [],
    errors: [],
    sample: [],
    errorsTruncated: false,
    sampleTruncated: false,
  }
}

function negadoCommit(): CommitResult {
  return {
    ok: false,
    error: 'Sem permissão para importar estrutura comercial.',
    criadas: 0,
    atualizadas: 0,
    ignoradas: 0,
  }
}

/**
 * Prévia. Não grava nada — é o "nada gravado antes da confirmação" da etapa 7.
 */
export async function previewEstruturaComercial(
  entidade: EstruturaComercialKey,
  csvText: string,
): Promise<PreviewResult> {
  if (!(await autorizado())) return negadoPreview(LABELS[entidade] ?? [])
  const sb = createClient()
  switch (entidade) {
    case 'diretores':
      return runPreview(diretoresSpec, csvText, sb)
    case 'gestores':
      return runPreview(gestoresSpec, csvText, sb)
    case 'equipes':
      return runPreview(equipesSpec, csvText, sb)
    case 'consultores':
      return runPreview(consultoresSpec, csvText, sb)
  }
}

/**
 * Confirmação. Grava.
 *
 * A ordem importa: `diretores → gestores → equipes → consultores`. Cada
 * entidade referencia a anterior, e o `resolve` não cria referência ausente —
 * importar consultores antes das equipes produz erro de linha, não equipe
 * inventada.
 *
 * Sem `revalidatePath`: não há tela de estrutura comercial nesta sprint para
 * revalidar. Quando ela existir, o caminho entra aqui.
 */
export async function commitEstruturaComercial(
  entidade: EstruturaComercialKey,
  csvText: string,
): Promise<CommitResult> {
  if (!(await autorizado())) return negadoCommit()
  const sb = createClient()
  switch (entidade) {
    case 'diretores':
      return runCommit(diretoresSpec, csvText, sb)
    case 'gestores':
      return runCommit(gestoresSpec, csvText, sb)
    case 'equipes':
      return runCommit(equipesSpec, csvText, sb)
    case 'consultores':
      return runCommit(consultoresSpec, csvText, sb)
  }
}
