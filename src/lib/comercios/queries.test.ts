import { describe, expect, it, vi, beforeEach } from 'vitest'

const from = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ from }) }))

const { contarComercios, listarComercios } = await import('./queries')

/**
 * Dublê mínimo do PostgREST: registra as chamadas encadeadas e devolve o
 * resultado combinado. O que se mede aqui é a FORMA da consulta — contra qual
 * relação, com quais filtros — porque é nela que mora a decisão de desenho.
 *
 * O que estes testes NÃO provam: que o PostgREST responde assim. O egress para
 * `supabase.co` é bloqueado neste ambiente, e nenhuma consulta deste projeto
 * jamais foi executada contra um PostgREST real daqui. O recorte da view está
 * exercitado no banco por `supabase/dev/comportamento/0015_view.sql`; o que
 * fica sem cobertura executável é a tradução PostgREST → SQL.
 */
function construtor(resultado: { data?: unknown; count?: number }) {
  const chamadas: string[] = []
  const alvo: Record<string, unknown> = {}
  const encadeia =
    (nome: string) =>
    (...args: unknown[]) => {
      chamadas.push(
        `${nome}(${args.filter((a) => typeof a !== 'object').join(',')})`,
      )
      return alvo
    }
  for (const m of ['select', 'eq', 'is', 'or', 'order', 'range', 'in'])
    alvo[m] = encadeia(m)
  // `await` numa query do PostgREST resolve pelo `then` do próprio builder.
  alvo.then = (ok: (v: unknown) => unknown) =>
    Promise.resolve(
      ok({
        data: resultado.data ?? [],
        count: resultado.count ?? 0,
        error: null,
      }),
    )
  return { alvo, chamadas }
}

beforeEach(() => from.mockReset())

describe('contarComercios', () => {
  it('conta sempre contra a view, nunca contra companies', async () => {
    const relacoes: string[] = []
    from.mockImplementation((rel: string) => {
      relacoes.push(rel)
      return construtor({ count: 3 }).alvo
    })
    await contarComercios('comercial')
    expect(new Set(relacoes)).toEqual(new Set(['crm_merchant_origin_status']))
  })

  it('não aplica filtro de interface — o número não muda com a tela', async () => {
    const vistas: string[][] = []
    from.mockImplementation(() => {
      const c = construtor({ count: 1 })
      vistas.push(c.chamadas)
      return c.alvo
    })
    await contarComercios('comercial')
    // Só o filtro que o PRÓPRIO contador mede pode aparecer.
    const filtros = vistas
      .flat()
      .filter((c) => c.startsWith('or(') || c.startsWith('range('))
    expect(filtros).toEqual([])
  })

  it('para consultor, sem responsável NÃO SE APLICA — e não é zero', async () => {
    from.mockImplementation(() => construtor({ count: 7 }).alvo)
    const c = await contarComercios('comercial')
    expect(c.semResponsavel).toEqual({ seAplica: false })
  })

  it('para gestão, sem responsável é contado', async () => {
    from.mockImplementation(() => construtor({ count: 7 }).alvo)
    const c = await contarComercios('gestor_adm')
    expect(c.semResponsavel).toEqual({ seAplica: true, valor: 7 })
  })
})

describe('listarComercios', () => {
  it('lê da mesma view que os contadores', async () => {
    const relacoes: string[] = []
    from.mockImplementation((rel: string) => {
      relacoes.push(rel)
      return construtor({ data: [] }).alvo
    })
    await listarComercios()
    expect(relacoes[0]).toBe('crm_merchant_origin_status')
  })

  it('escapa vírgula e parêntese na busca — seriam sintaxe do filtro', async () => {
    let chamadas: string[] = []
    from.mockImplementation(() => {
      const c = construtor({ data: [] })
      chamadas = c.chamadas
      return c.alvo
    })
    await listarComercios({ busca: 'Padaria, Ltda (ME)' })
    const or = chamadas.find((c) => c.startsWith('or('))
    expect(or).toBeDefined()
    expect(or).not.toContain('Ltda (ME)')
    expect(or).toContain('Padaria')
  })

  it('não consulta sellers quando nenhuma linha tem responsável', async () => {
    const relacoes: string[] = []
    from.mockImplementation((rel: string) => {
      relacoes.push(rel)
      return construtor({
        data: [
          {
            relationship_id: 'r1',
            company_id: 'c1',
            legal_name: 'Comércio',
            trade_name: null,
            cnpj: null,
            municipio: null,
            uf: null,
            responsible_seller_id: null,
            tem_origem: false,
            company_created_at: '2026-08-01T00:00:00Z',
          },
        ],
      }).alvo
    })
    const { linhas } = await listarComercios()
    expect(relacoes).toEqual(['crm_merchant_origin_status'])
    const primeira = linhas[0]
    expect(primeira).toBeDefined()
    expect(primeira?.responsavelNome).toBeNull()
    expect(primeira?.temOrigem).toBe(false)
  })
})
