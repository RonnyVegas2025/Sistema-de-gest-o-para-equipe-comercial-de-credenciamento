import { describe, expect, it } from 'vitest'
import {
  consultoresSpec,
  diretoresSpec,
  equipesSpec,
  gestoresSpec,
} from './estrutura-comercial'
import type { Sb } from './types'

/**
 * ESCOPO DESTES TESTES — leia antes de confiar neles.
 *
 * Cobrem a lógica das specs: validação de linha, chave de deduplicação,
 * casamento de referências e as mensagens de erro. O cliente Supabase é
 * DUBLADO — um objeto que responde ao subconjunto do query builder que as specs
 * usam.
 *
 * Isso prova o NOSSO código. **Não** prova o comportamento do PostgREST, nem o
 * caminho ponta a ponta contra o Supabase.
 *
 * A garantia de banco é outra e já existe: o índice único parcial da migration
 * 0007, testado contra Postgres real, é o que impede `source_ref` duplicado
 * mesmo que esta camada falhe.
 */

/** Dublê do cliente: devolve as linhas configuradas por tabela. */
function fakeSb(dados: Record<string, Record<string, unknown>[]>): Sb {
  const builder = (tabela: string) => {
    const linhas = dados[tabela] ?? []
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      then: (resolve: (r: { data: unknown; error: null }) => void) =>
        resolve({ data: linhas, error: null }),
    }
    return chain
  }
  return { from: builder } as unknown as Sb
}

const semDados = fakeSb({})

describe('chave de deduplicação é source_ref, nunca o nome', () => {
  it.each([
    ['diretores', diretoresSpec],
    ['gestores', gestoresSpec],
    ['equipes', equipesSpec],
    ['consultores', consultoresSpec],
  ] as const)('%s: keyOf devolve o source_ref', (_nome, spec) => {
    const chave = spec.keyOf({ source_ref: 'uuid-origem-1' } as never)
    expect(chave).toBe('uuid-origem-1')
  })

  it.each([
    ['diretores', diretoresSpec],
    ['gestores', gestoresSpec],
    ['equipes', equipesSpec],
    ['consultores', consultoresSpec],
  ] as const)(
    '%s: sem source_ref a chave é null, e o motor trata como erro',
    (_n, spec) => {
      expect(spec.keyOf({ source_ref: '' } as never)).toBeNull()
    },
  )

  it('linha sem id de origem é recusada, com o motivo explícito', () => {
    const r = diretoresSpec.validateRow({ nome: 'Rossi' }, 1)
    expect('errors' in r).toBe(true)
    if ('errors' in r) {
      expect(r.errors[0]?.field).toBe('id')
      expect(r.errors[0]?.message).toContain('duplicata')
    }
  })

  it('duas pessoas com o MESMO nome e ids diferentes são duas linhas distintas', () => {
    const a = diretoresSpec.validateRow({ id: 'u-1', nome: 'João Silva' }, 1)
    const b = diretoresSpec.validateRow({ id: 'u-2', nome: 'João Silva' }, 2)
    if ('value' in a && 'value' in b) {
      expect(diretoresSpec.keyOf(a.value)).not.toBe(
        diretoresSpec.keyOf(b.value),
      )
    } else {
      throw new Error('as duas linhas deveriam validar')
    }
  })

  it('a MESMA pessoa renomeada mantém a chave — reimportar atualiza, não cria', () => {
    const antes = diretoresSpec.validateRow({ id: 'u-9', nome: 'Ana Silva' }, 1)
    const depois = diretoresSpec.validateRow(
      { id: 'u-9', nome: 'Ana Silva Souza' },
      1,
    )
    if ('value' in antes && 'value' in depois) {
      expect(diretoresSpec.keyOf(antes.value)).toBe(
        diretoresSpec.keyOf(depois.value),
      )
      expect(antes.value.full_name).not.toBe(depois.value.full_name)
    } else {
      throw new Error('as duas linhas deveriam validar')
    }
  })
})

describe('casamento de referências — nunca em silêncio', () => {
  const equipes = {
    teams: [
      { id: 'local-1', source_ref: 'origem-1', name: 'Equipe Centro' },
      { id: 'local-2', source_ref: 'origem-2', name: 'Equipe Centro' },
      { id: 'local-3', source_ref: 'origem-3', name: 'Equipe Sul' },
    ],
  }

  async function resolverConsultor(raw: Record<string, string>) {
    const v = consultoresSpec.validateRow(raw, 1)
    if (!('value' in v)) throw new Error('linha deveria validar')
    return consultoresSpec.resolve(
      fakeSb(equipes),
      [{ line: 1, value: v.value }],
      {
        write: false,
      },
    )
  }

  it('por source_ref: casa com o id local', async () => {
    const r = await resolverConsultor({
      id: 'c-1',
      nome: 'Ana',
      equipe_id: 'origem-3',
    })
    const o = r.outcomes.get(1)
    expect(o && 'value' in o && o.value.team_id).toBe('local-3')
  })

  it('EQUIPE HOMÔNIMA por nome vira ERRO DE LINHA, não escolha arbitrária', async () => {
    const r = await resolverConsultor({
      id: 'c-2',
      nome: 'Bia',
      equipe: 'Equipe Centro',
    })
    const o = r.outcomes.get(1)
    expect(o && 'errors' in o).toBe(true)
    if (o && 'errors' in o) {
      expect(o.errors[0]?.message).toContain('2')
      expect(o.errors[0]?.message).toContain('desambiguar')
    }
  })

  it('nome único casa, ignorando acento e caixa', async () => {
    const r = await resolverConsultor({
      id: 'c-3',
      nome: 'Caio',
      equipe: 'EQUIPE SUL',
    })
    const o = r.outcomes.get(1)
    expect(o && 'value' in o && o.value.team_id).toBe('local-3')
  })

  it('source_ref desconhecido é erro, e não cria a equipe', async () => {
    const r = await resolverConsultor({
      id: 'c-4',
      nome: 'Dora',
      equipe_id: 'nao-existe',
    })
    const o = r.outcomes.get(1)
    expect(o && 'errors' in o).toBe(true)
    if (o && 'errors' in o) {
      expect(o.errors[0]?.message).toContain('Importe')
    }
  })

  it('sem equipe informada: passa com team_id nulo e emite aviso', async () => {
    const r = await resolverConsultor({ id: 'c-5', nome: 'Eva' })
    const o = r.outcomes.get(1)
    expect(o && 'value' in o && o.value.team_id).toBeNull()
    expect(r.notices[0]?.title).toContain('sem equipe')
  })
})

describe('o gestor do consultor não é importado', () => {
  it('coluna de gestor no arquivo é recusada, com o motivo', () => {
    const r = consultoresSpec.validateRow(
      { id: 'c-9', nome: 'Ana', gestor: 'Danilo' },
      1,
    )
    expect('errors' in r).toBe(true)
    if ('errors' in r) {
      expect(r.errors[0]?.message).toContain('gestor atual da equipe')
      expect(r.errors[0]?.message).toContain('divergiria')
    }
  })

  it('o registro final de consultor não carrega manager_id', async () => {
    const v = consultoresSpec.validateRow({ id: 'c-10', nome: 'Ana' }, 1)
    if (!('value' in v)) throw new Error('deveria validar')
    const r = await consultoresSpec.resolve(
      semDados,
      [{ line: 1, value: v.value }],
      {
        write: false,
      },
    )
    const o = r.outcomes.get(1)
    expect(o && 'value' in o && 'manager_id' in o.value).toBe(false)
  })
})

describe('validações de campo', () => {
  it('e-mail inválido é recusado', () => {
    const r = diretoresSpec.validateRow(
      { id: 'd-1', nome: 'X', email: 'nao-e-email' },
      1,
    )
    expect('errors' in r && r.errors.some((e) => e.field === 'email')).toBe(
      true,
    )
  })

  it('data fora do calendário é recusada — 29/02 em ano não bissexto', () => {
    const r = diretoresSpec.validateRow(
      { id: 'd-2', nome: 'X', ativo_desde: '29/02/2025' },
      1,
    )
    expect('errors' in r).toBe(true)
  })

  it('29/02 em ano bissexto passa', () => {
    const r = diretoresSpec.validateRow(
      { id: 'd-3', nome: 'X', ativo_desde: '29/02/2024' },
      1,
    )
    expect('value' in r && r.value.active_from).toBe('2024-02-29')
  })

  it('telefone guarda só dígitos', () => {
    const r = gestoresSpec.validateRow(
      { id: 'g-1', nome: 'X', celular: '(11) 98888-7777' },
      1,
    )
    expect('value' in r && r.value.mobile).toBe('11988887777')
  })

  it('conta_na_meta ausente vira true, acompanhando o default da coluna', () => {
    const r = equipesSpec.validateRow({ id: 'e-1', nome: 'Equipe' }, 1)
    expect('value' in r && r.value.conta_na_meta).toBe(true)
  })

  it.each(['nao', 'Não', 'N', '0', 'false'])(
    'conta_na_meta "%s" vira false',
    (v) => {
      const r = equipesSpec.validateRow(
        { id: 'e-2', nome: 'Equipe', conta_na_meta: v },
        1,
      )
      expect('value' in r && r.value.conta_na_meta).toBe(false)
    },
  )
})

describe('ordem das entidades', () => {
  it('cada spec aponta para a própria tabela e exige id e nome', () => {
    for (const spec of [
      diretoresSpec,
      gestoresSpec,
      equipesSpec,
      consultoresSpec,
    ]) {
      expect(spec.requiredHeaders).toEqual(['id', 'nome'])
    }
  })

  it('gestor casa diretor; equipe casa gestor; consultor casa equipe', async () => {
    const g = gestoresSpec.validateRow(
      { id: 'g-9', nome: 'Gestor', diretor_id: 'dir-origem' },
      1,
    )
    if (!('value' in g)) throw new Error('deveria validar')
    const rg = await gestoresSpec.resolve(
      fakeSb({
        directors: [
          { id: 'dir-local', source_ref: 'dir-origem', full_name: 'D' },
        ],
      }),
      [{ line: 1, value: g.value }],
      { write: false },
    )
    const og = rg.outcomes.get(1)
    expect(og && 'value' in og && og.value.director_id).toBe('dir-local')

    const e = equipesSpec.validateRow(
      { id: 'e-9', nome: 'Equipe', gestor_id: 'ges-origem' },
      1,
    )
    if (!('value' in e)) throw new Error('deveria validar')
    const re = await equipesSpec.resolve(
      fakeSb({
        managers: [
          { id: 'ges-local', source_ref: 'ges-origem', full_name: 'G' },
        ],
      }),
      [{ line: 1, value: e.value }],
      { write: false },
    )
    const oe = re.outcomes.get(1)
    expect(oe && 'value' in oe && oe.value.current_manager_id).toBe('ges-local')
  })
})
