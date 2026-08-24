import { rows } from '@/lib/supabase/query'
import { brDateToIso } from './dates'
import { norm } from './norm'
import type {
  ImportSpec,
  Notice,
  ResolveOutcome,
  ResolveResult,
  RowError,
  Sb,
  ValidatedRow,
} from './types'

/**
 * Importação da estrutura comercial: diretores, gestores, equipes e vendedores.
 *
 * O Painel ADM é a fonte de verdade dessas quatro entidades (D-004); o CRM as
 * carrega por importação, na ordem `directors → managers → teams → sellers`,
 * porque cada uma referencia a anterior.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTA SPEC FAZ DIFERENTE DA ORIGEM
 *
 * A spec de vendedores do sistema de origem casa a equipe por nome normalizado
 * e deduplica o vendedor por nome normalizado, porque lá "vendedor não tem
 * chave natural única". Isso basta onde há uma fonte só. Não basta para
 * replicação entre bancos:
 *
 *   - homônimo colide e vira a mesma pessoa;
 *   - casamento muda sobrenome e vira pessoa nova;
 *   - corrigir um erro de digitação no nome vira pessoa nova.
 *
 * Aqui a chave é `source_ref` — o UUID da linha no Painel. Nome é rótulo.
 *
 * ---------------------------------------------------------------------------
 * REFERÊNCIAS ENTRE ENTIDADES
 *
 * O caminho preferencial é por `source_ref`: `diretor_id`, `gestor_id` e
 * `equipe_id` no arquivo trazem o UUID da ORIGEM, e o `resolve` os traduz para
 * o `id` local.
 *
 * Há um caminho alternativo por NOME (`diretor`, `gestor`, `equipe`), para o
 * caso de a exportação não trazer a coluna de id. Ele nunca casa em silêncio:
 *
 *   nenhuma correspondência  → erro de linha
 *   mais de uma (homônima)   → erro de linha, com as candidatas na mensagem
 *   exatamente uma           → casa
 *
 * ---------------------------------------------------------------------------
 * O `resolve` NUNCA CRIA NADA
 *
 * No sistema de origem, `resolve(write: true)` cria produtos que faltam. Aqui
 * não: a importação de vendedores não cria equipes, a de equipes não cria
 * gestores. Referência ausente é erro de linha, e a entidade referenciada tem
 * de ser importada antes — é para isso que a ordem existe.
 *
 * Consequência: o parâmetro `write` não muda o comportamento do `resolve`
 * destas specs. Ele permanece na assinatura porque é o contrato do motor, e
 * está documentado aqui para ninguém procurar a diferença que não existe.
 * ---------------------------------------------------------------------------
 */

type Tabela = 'directors' | 'managers' | 'teams' | 'sellers'

/** Rótulo humano de cada tabela, para mensagens de erro. */
const ROTULO: Record<Tabela, string> = {
  directors: 'Diretor',
  managers: 'Gestor',
  teams: 'Equipe',
  sellers: 'Consultor',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Uma linha de referência já carregada do banco, para casar por id ou nome. */
type Referencia = { id: string; source_ref: string | null; rotulo: string }

/**
 * Carrega uma tabela de referência inteira e monta dois índices: por
 * `source_ref` e por nome normalizado. O segundo guarda LISTA, não valor único —
 * é o que permite detectar homônimo em vez de escolher um em silêncio.
 */
async function carregarReferencias(
  sb: Sb,
  tabela: Exclude<Tabela, 'sellers'>,
): Promise<{
  porSourceRef: Map<string, Referencia>
  porNome: Map<string, Referencia[]>
}> {
  const coluna = tabela === 'teams' ? 'name' : 'full_name'
  const lidas = rows(
    await sb
      .from(tabela)
      .select(`id, source_ref, ${coluna}`)
      .eq('status', 'ativo'),
  ) as unknown as Record<string, string | null>[]

  const porSourceRef = new Map<string, Referencia>()
  const porNome = new Map<string, Referencia[]>()

  for (const linha of lidas) {
    const rotulo = linha[coluna] ?? ''
    const ref: Referencia = {
      id: linha.id as string,
      source_ref: linha.source_ref ?? null,
      rotulo,
    }
    if (ref.source_ref) porSourceRef.set(ref.source_ref, ref)
    const chave = norm(rotulo)
    if (chave) porNome.set(chave, [...(porNome.get(chave) ?? []), ref])
  }

  return { porSourceRef, porNome }
}

/**
 * Casa uma referência. `sourceRef` tem prioridade; o nome é alternativa, e
 * ambiguidade é erro.
 */
function casarReferencia(
  indices: {
    porSourceRef: Map<string, Referencia>
    porNome: Map<string, Referencia[]>
  },
  alvo: Exclude<Tabela, 'sellers'>,
  campo: string,
  sourceRef: string,
  nome: string,
): { id: string } | { erro: RowError } {
  if (sourceRef) {
    const achado = indices.porSourceRef.get(sourceRef)
    if (achado) return { id: achado.id }
    return {
      erro: {
        field: campo,
        message: `${ROTULO[alvo]} de origem "${sourceRef}" não encontrado. Importe ${ROTULO[alvo].toLowerCase()}es antes.`,
      },
    }
  }

  if (!nome) return { id: '' } // referência ausente é tratada pelo chamador

  const candidatas = indices.porNome.get(norm(nome)) ?? []
  if (candidatas.length === 1) return { id: (candidatas[0] as Referencia).id }
  if (candidatas.length === 0) {
    return {
      erro: {
        field: campo,
        message: `${ROTULO[alvo]} "${nome}" não encontrado. Importe ${ROTULO[alvo].toLowerCase()}es antes, ou informe a coluna de id de origem.`,
      },
    }
  }
  return {
    erro: {
      field: campo,
      message: `"${nome}" corresponde a ${candidatas.length} ${ROTULO[alvo].toLowerCase()}es. Informe a coluna de id de origem para desambiguar.`,
    },
  }
}

/** Campos comuns a todas as linhas cruas. */
type Base = { source_ref: string }

function validarBase(raw: Record<string, string>, errors: RowError[]): string {
  const sourceRef = (raw.id ?? '').trim()
  if (!sourceRef) {
    errors.push({
      field: 'id',
      message:
        'Informe o id de origem. Ele é a chave da importação — sem ele a reimportação criaria duplicata.',
    })
  }
  return sourceRef
}

function validarEmail(
  raw: Record<string, string>,
  errors: RowError[],
): string | null {
  const valor = (raw.email ?? '').trim()
  if (!valor) return null
  if (!EMAIL_RE.test(valor)) {
    errors.push({ field: 'email', message: 'E-mail inválido' })
    return null
  }
  return valor
}

function validarData(
  raw: Record<string, string>,
  campo: string,
  errors: RowError[],
): string | null {
  const valor = (raw[campo] ?? '').trim()
  if (!valor) return null
  const iso = brDateToIso(valor)
  if (!iso) {
    errors.push({
      field: campo,
      message: `Data inválida em "${campo}" (use dd/mm/aaaa)`,
    })
    return null
  }
  return iso
}

function apenasDigitos(
  raw: Record<string, string>,
  campo: string,
): string | null {
  const digitos = (raw[campo] ?? '').replace(/\D/g, '')
  return digitos ? digitos : null
}

/**
 * Fábrica das quatro specs. O que varia é a validação da linha, as referências
 * a resolver e as colunas gravadas; a chave de deduplicação e a persistência são
 * as mesmas — por `source_ref`, sempre.
 */
function criarSpec<TRaw extends Base, TFinal extends Base>(config: {
  tabela: Tabela
  entity: string
  requiredHeaders: string[]
  columnLabels: string[]
  template: { headers: string; example: string; filename: string }
  validateRow(raw: Record<string, string>, line: number): ValidatedRow<TRaw>
  displayCells(raw: Record<string, string>): string[]
  resolve(
    sb: Sb,
    items: { line: number; value: TRaw }[],
    opts: { write: boolean },
  ): Promise<ResolveResult<TFinal>>
}): ImportSpec<TRaw, TFinal> {
  return {
    entity: config.entity,
    requiredHeaders: config.requiredHeaders,
    columnLabels: config.columnLabels,
    template: config.template,
    validateRow: config.validateRow,
    displayCells: config.displayCells,
    resolve: config.resolve,

    /**
     * A chave é o `source_ref` e nada mais. `null` faz o motor tratar a linha
     * como erro — que é o comportamento correto: sem chave estável, gravar
     * significaria duplicar na próxima importação.
     */
    keyOf(value) {
      return value.source_ref || null
    },

    async loadExisting(sb, keys) {
      const encontrados = new Map<string, string>()
      if (keys.length === 0) return encontrados
      const lidas = rows(
        await sb
          .from(config.tabela)
          .select('id, source_ref')
          .in('source_ref', keys),
      ) as unknown as { id: string; source_ref: string | null }[]
      for (const linha of lidas) {
        if (linha.source_ref) encontrados.set(linha.source_ref, linha.id)
      }
      return encontrados
    },

    async insertChunk(sb, values) {
      const { error } = await sb.from(config.tabela).insert(values as never)
      if (error) throw error
    },

    async updateChunk(sb, items) {
      for (const item of items) {
        const { error } = await sb
          .from(config.tabela)
          .update(item.value as never)
          .eq('id', item.id)
        if (error) throw error
      }
    },
  }
}

/** `resolve` identidade — para as entidades sem referência a casar. */
async function semReferencias<T extends Base>(
  _sb: Sb,
  items: { line: number; value: T }[],
): Promise<ResolveResult<T>> {
  const outcomes = new Map<number, ResolveOutcome<T>>()
  for (const item of items) outcomes.set(item.line, { value: item.value })
  return { outcomes, notices: [] }
}

// ===========================================================================
// 1. Diretores — sem referências
// ===========================================================================
type DiretorRaw = Base & {
  full_name: string
  email: string | null
  active_from: string | null
  active_to: string | null
}

export const diretoresSpec = criarSpec<DiretorRaw, DiretorRaw>({
  tabela: 'directors',
  entity: 'Diretores',
  requiredHeaders: ['id', 'nome'],
  columnLabels: ['Id de origem', 'Nome', 'E-mail', 'Ativo desde', 'Ativo até'],
  template: {
    headers: 'id,nome,email,ativo_desde,ativo_ate',
    example:
      'a1b2c3d4-0000-0000-0000-000000000001,Rossi Diretor,rossi@vegascard.com.br,01/03/2024,',
    filename: 'modelo-diretores.csv',
  },
  validateRow(raw) {
    const errors: RowError[] = []
    const source_ref = validarBase(raw, errors)
    const full_name = (raw.nome ?? '').trim()
    if (!full_name) errors.push({ field: 'nome', message: 'Informe o nome' })
    const email = validarEmail(raw, errors)
    const active_from = validarData(raw, 'ativo_desde', errors)
    const active_to = validarData(raw, 'ativo_ate', errors)
    if (errors.length > 0) return { errors }
    return { value: { source_ref, full_name, email, active_from, active_to } }
  },
  displayCells(raw) {
    return [
      (raw.id ?? '').trim(),
      (raw.nome ?? '').trim(),
      (raw.email ?? '').trim(),
      (raw.ativo_desde ?? '').trim(),
      (raw.ativo_ate ?? '').trim(),
    ]
  },
  resolve: semReferencias,
})

// ===========================================================================
// 2. Gestores — referenciam diretor
// ===========================================================================
type GestorRaw = Base & {
  full_name: string
  email: string | null
  role_title: string | null
  mobile: string | null
  phone: string | null
  active_from: string | null
  active_to: string | null
  diretor_source_ref: string
  diretor_nome: string
}

type GestorFinal = Omit<GestorRaw, 'diretor_source_ref' | 'diretor_nome'> & {
  director_id: string | null
}

export const gestoresSpec = criarSpec<GestorRaw, GestorFinal>({
  tabela: 'managers',
  entity: 'Gestores',
  requiredHeaders: ['id', 'nome'],
  columnLabels: [
    'Id de origem',
    'Nome',
    'E-mail',
    'Cargo',
    'Celular',
    'Telefone',
    'Diretor',
    'Ativo desde',
    'Ativo até',
  ],
  template: {
    headers:
      'id,nome,email,cargo,celular,telefone,diretor_id,diretor,ativo_desde,ativo_ate',
    example:
      'b1b2c3d4-0000-0000-0000-000000000001,Danilo Gestor,danilo@vegascard.com.br,Gerente,11988887777,,a1b2c3d4-0000-0000-0000-000000000001,,01/03/2024,',
    filename: 'modelo-gestores.csv',
  },
  validateRow(raw) {
    const errors: RowError[] = []
    const source_ref = validarBase(raw, errors)
    const full_name = (raw.nome ?? '').trim()
    if (!full_name) errors.push({ field: 'nome', message: 'Informe o nome' })
    const email = validarEmail(raw, errors)
    const active_from = validarData(raw, 'ativo_desde', errors)
    const active_to = validarData(raw, 'ativo_ate', errors)
    if (errors.length > 0) return { errors }
    return {
      value: {
        source_ref,
        full_name,
        email,
        role_title: (raw.cargo ?? '').trim() || null,
        mobile: apenasDigitos(raw, 'celular'),
        phone: apenasDigitos(raw, 'telefone'),
        active_from,
        active_to,
        diretor_source_ref: (raw.diretor_id ?? '').trim(),
        diretor_nome: (raw.diretor ?? '').trim(),
      },
    }
  },
  displayCells(raw) {
    return [
      (raw.id ?? '').trim(),
      (raw.nome ?? '').trim(),
      (raw.email ?? '').trim(),
      (raw.cargo ?? '').trim(),
      (raw.celular ?? '').trim(),
      (raw.telefone ?? '').trim(),
      (raw.diretor_id ?? '').trim() || (raw.diretor ?? '').trim(),
      (raw.ativo_desde ?? '').trim(),
      (raw.ativo_ate ?? '').trim(),
    ]
  },
  async resolve(sb, items) {
    const indices = await carregarReferencias(sb, 'directors')
    const outcomes = new Map<number, ResolveOutcome<GestorFinal>>()
    let semDiretor = 0

    for (const { line, value } of items) {
      const { diretor_source_ref, diretor_nome, ...resto } = value
      if (!diretor_source_ref && !diretor_nome) {
        semDiretor += 1
        outcomes.set(line, { value: { ...resto, director_id: null } })
        continue
      }
      const casado = casarReferencia(
        indices,
        'directors',
        'diretor',
        diretor_source_ref,
        diretor_nome,
      )
      if ('erro' in casado) {
        outcomes.set(line, { errors: [casado.erro] })
        continue
      }
      outcomes.set(line, {
        value: { ...resto, director_id: casado.id || null },
      })
    }

    const notices: Notice[] = []
    if (semDiretor > 0) {
      notices.push({
        title: 'Gestores sem diretor informado',
        items: [
          `${semDiretor} linha(s) — o vínculo fica vazio e pode ser preenchido depois.`,
        ],
      })
    }
    return { outcomes, notices }
  },
})

// ===========================================================================
// 3. Equipes — referenciam gestor atual
// ===========================================================================
type EquipeRaw = Base & {
  name: string
  description: string | null
  conta_na_meta: boolean
  valid_from: string | null
  valid_to: string | null
  gestor_source_ref: string
  gestor_nome: string
}

type EquipeFinal = Omit<EquipeRaw, 'gestor_source_ref' | 'gestor_nome'> & {
  current_manager_id: string | null
}

export const equipesSpec = criarSpec<EquipeRaw, EquipeFinal>({
  tabela: 'teams',
  entity: 'Equipes',
  requiredHeaders: ['id', 'nome'],
  columnLabels: [
    'Id de origem',
    'Nome',
    'Descrição',
    'Gestor atual',
    'Conta na meta',
    'Vigência de',
    'Vigência até',
  ],
  template: {
    headers:
      'id,nome,descricao,gestor_id,gestor,conta_na_meta,vigencia_de,vigencia_ate',
    example:
      'c1b2c3d4-0000-0000-0000-000000000001,Equipe Centro,,b1b2c3d4-0000-0000-0000-000000000001,,sim,01/03/2024,',
    filename: 'modelo-equipes.csv',
  },
  validateRow(raw) {
    const errors: RowError[] = []
    const source_ref = validarBase(raw, errors)
    const name = (raw.nome ?? '').trim()
    if (!name) errors.push({ field: 'nome', message: 'Informe o nome' })

    // Ausente = true, que é o default da coluna. Só "nao"/"não"/"0"/"false" desliga.
    const metaBruto = norm((raw.conta_na_meta ?? '').trim())
    const conta_na_meta = !['nao', 'n', '0', 'false'].includes(metaBruto)

    const valid_from = validarData(raw, 'vigencia_de', errors)
    const valid_to = validarData(raw, 'vigencia_ate', errors)
    if (errors.length > 0) return { errors }
    return {
      value: {
        source_ref,
        name,
        description: (raw.descricao ?? '').trim() || null,
        conta_na_meta,
        valid_from,
        valid_to,
        gestor_source_ref: (raw.gestor_id ?? '').trim(),
        gestor_nome: (raw.gestor ?? '').trim(),
      },
    }
  },
  displayCells(raw) {
    return [
      (raw.id ?? '').trim(),
      (raw.nome ?? '').trim(),
      (raw.descricao ?? '').trim(),
      (raw.gestor_id ?? '').trim() || (raw.gestor ?? '').trim(),
      (raw.conta_na_meta ?? '').trim(),
      (raw.vigencia_de ?? '').trim(),
      (raw.vigencia_ate ?? '').trim(),
    ]
  },
  async resolve(sb, items) {
    const indices = await carregarReferencias(sb, 'managers')
    const outcomes = new Map<number, ResolveOutcome<EquipeFinal>>()
    let semGestor = 0

    for (const { line, value } of items) {
      const { gestor_source_ref, gestor_nome, ...resto } = value
      if (!gestor_source_ref && !gestor_nome) {
        semGestor += 1
        outcomes.set(line, { value: { ...resto, current_manager_id: null } })
        continue
      }
      const casado = casarReferencia(
        indices,
        'managers',
        'gestor',
        gestor_source_ref,
        gestor_nome,
      )
      if ('erro' in casado) {
        outcomes.set(line, { errors: [casado.erro] })
        continue
      }
      outcomes.set(line, {
        value: { ...resto, current_manager_id: casado.id || null },
      })
    }

    const notices: Notice[] = []
    if (semGestor > 0) {
      notices.push({
        title: 'Equipes sem gestor informado',
        items: [
          `${semGestor} linha(s) — a equipe fica sem gestor atual até ser atribuído.`,
        ],
      })
    }
    return { outcomes, notices }
  },
})

// ===========================================================================
// 4. Consultores — referenciam equipe. O GESTOR NÃO É IMPORTADO.
// ===========================================================================
type ConsultorRaw = Base & {
  full_name: string
  email: string | null
  phone: string | null
  mobile: string | null
  joined_at: string | null
  left_at: string | null
  equipe_source_ref: string
  equipe_nome: string
}

type ConsultorFinal = Omit<
  ConsultorRaw,
  'equipe_source_ref' | 'equipe_nome'
> & {
  team_id: string | null
}

export const consultoresSpec = criarSpec<ConsultorRaw, ConsultorFinal>({
  tabela: 'sellers',
  entity: 'Consultores',
  requiredHeaders: ['id', 'nome'],
  columnLabels: [
    'Id de origem',
    'Nome',
    'E-mail',
    'Telefone',
    'Celular',
    'Equipe',
    'Entrou em',
    'Saiu em',
  ],
  template: {
    headers:
      'id,nome,email,telefone,celular,equipe_id,equipe,entrou_em,saiu_em',
    example:
      'd1b2c3d4-0000-0000-0000-000000000001,Ana Consultora,ana@vegascard.com.br,,11977776666,c1b2c3d4-0000-0000-0000-000000000001,,01/04/2024,',
    filename: 'modelo-consultores.csv',
  },
  validateRow(raw) {
    const errors: RowError[] = []
    const source_ref = validarBase(raw, errors)
    const full_name = (raw.nome ?? '').trim()
    if (!full_name) errors.push({ field: 'nome', message: 'Informe o nome' })
    const email = validarEmail(raw, errors)
    const joined_at = validarData(raw, 'entrou_em', errors)
    const left_at = validarData(raw, 'saiu_em', errors)

    // Uma coluna `gestor` no arquivo é ignorada de propósito, e avisamos: o
    // gestor do consultor é derivado da equipe (teams.current_manager_id).
    if ((raw.gestor ?? '').trim() || (raw.gestor_id ?? '').trim()) {
      errors.push({
        field: 'gestor',
        message:
          'Remova a coluna de gestor. O gestor do consultor é o gestor atual da equipe, e gravá-lo aqui criaria uma segunda fonte que divergiria na primeira troca.',
      })
    }

    if (errors.length > 0) return { errors }
    return {
      value: {
        source_ref,
        full_name,
        email,
        phone: apenasDigitos(raw, 'telefone'),
        mobile: apenasDigitos(raw, 'celular'),
        joined_at,
        left_at,
        equipe_source_ref: (raw.equipe_id ?? '').trim(),
        equipe_nome: (raw.equipe ?? '').trim(),
      },
    }
  },
  displayCells(raw) {
    return [
      (raw.id ?? '').trim(),
      (raw.nome ?? '').trim(),
      (raw.email ?? '').trim(),
      (raw.telefone ?? '').trim(),
      (raw.celular ?? '').trim(),
      (raw.equipe_id ?? '').trim() || (raw.equipe ?? '').trim(),
      (raw.entrou_em ?? '').trim(),
      (raw.saiu_em ?? '').trim(),
    ]
  },
  async resolve(sb, items) {
    const indices = await carregarReferencias(sb, 'teams')
    const outcomes = new Map<number, ResolveOutcome<ConsultorFinal>>()
    let semEquipe = 0

    for (const { line, value } of items) {
      const { equipe_source_ref, equipe_nome, ...resto } = value
      if (!equipe_source_ref && !equipe_nome) {
        semEquipe += 1
        outcomes.set(line, { value: { ...resto, team_id: null } })
        continue
      }
      const casado = casarReferencia(
        indices,
        'teams',
        'equipe',
        equipe_source_ref,
        equipe_nome,
      )
      if ('erro' in casado) {
        outcomes.set(line, { errors: [casado.erro] })
        continue
      }
      outcomes.set(line, { value: { ...resto, team_id: casado.id || null } })
    }

    const notices: Notice[] = []
    if (semEquipe > 0) {
      notices.push({
        title: 'Consultores sem equipe informada',
        items: [
          `${semEquipe} linha(s) — sem equipe, o consultor também fica sem gestor, porque o gestor é derivado dela.`,
        ],
      })
    }
    return { outcomes, notices }
  },
})

/** Ordem de execução. Cada uma referencia a anterior. */
export const ESTRUTURA_COMERCIAL_SPECS = [
  { chave: 'diretores', spec: diretoresSpec },
  { chave: 'gestores', spec: gestoresSpec },
  { chave: 'equipes', spec: equipesSpec },
  { chave: 'consultores', spec: consultoresSpec },
] as const

export type EstruturaComercialKey =
  (typeof ESTRUTURA_COMERCIAL_SPECS)[number]['chave']
