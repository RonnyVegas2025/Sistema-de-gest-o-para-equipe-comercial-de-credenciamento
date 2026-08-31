import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireProfile = vi.fn()
const inserts: { relacao: string; payload: unknown }[] = []
const respostas = new Map<string, { data?: unknown; error?: unknown }>()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({
  requireProfile: () => requireProfile(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (relacao: string) => ({
      insert: (payload: unknown) => {
        inserts.push({ relacao, payload })
        const r = respostas.get(relacao) ?? { data: null, error: null }
        return {
          select: () => ({ maybeSingle: async () => r }),
          then: (ok: (v: unknown) => unknown) => Promise.resolve(ok(r)),
        }
      },
    }),
  }),
}))

const { cadastrarComercio } = await import('./actions')

function form(over: Record<string, string> = {}) {
  const fd = new FormData()
  const base: Record<string, string> = {
    razaoSocial: 'Padaria do Bairro Ltda',
    cnpj: '11.222.333/0001-81',
    origemId: '11111111-1111-4111-8111-111111111111',
    origemExigeEmpresa: 'true',
    empresaDemandanteId: '22222222-2222-4222-8222-222222222222',
    responsavelId: '33333333-3333-4333-8333-333333333333',
    ...over,
  }
  for (const [k, v] of Object.entries(base)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  inserts.length = 0
  respostas.clear()
  respostas.set('companies', { data: { id: 'c-1' }, error: null })
  respostas.set('crm_company_relationships', { data: null, error: null })
  respostas.set('crm_accreditation_demands', { data: null, error: null })
  requireProfile.mockResolvedValue({ role: 'comercial', id: 'p-1' })
})

describe('cadastrarComercio', () => {
  it('recusa na aplicação antes de qualquer escrita', async () => {
    requireProfile.mockResolvedValue({ role: 'auditoria', id: 'p-9' })
    const r = await cadastrarComercio({}, form())
    expect(r).toMatchObject({ ok: false })
    expect(inserts).toHaveLength(0)
  })

  it('marca is_merchant — sem ele o registro some da própria página', async () => {
    await cadastrarComercio({}, form())
    const empresa = inserts.find((i) => i.relacao === 'companies')
    expect(empresa?.payload).toMatchObject({ is_merchant: true })
  })

  it('grava o CNPJ normalizado, nunca com pontuação', async () => {
    await cadastrarComercio({}, form())
    const empresa = inserts.find((i) => i.relacao === 'companies')
    expect(empresa?.payload).toMatchObject({ cnpj: '11222333000181' })
  })

  // A ordem não é estilo: o relacionamento é o que torna o comércio visível ao
  // consultor. Invertida, uma falha na demanda deixaria o registro invisível a
  // quem acabou de cadastrá-lo.
  it('escreve empresa → relacionamento → demanda, nesta ordem', async () => {
    await cadastrarComercio({}, form())
    expect(inserts.map((i) => i.relacao)).toEqual([
      'companies',
      'crm_company_relationships',
      'crm_accreditation_demands',
    ])
  })

  it('falha na demanda: diz que o comércio ficou como sem origem', async () => {
    respostas.set('crm_accreditation_demands', {
      error: {
        code: '23514',
        message: 'Esta origem exige a empresa cliente demandante.',
      },
    })
    const r = await cadastrarComercio({}, form())
    expect(r).toMatchObject({ ok: false })
    if ('error' in r && r.error) {
      expect(r.error).toContain(
        'Esta origem exige a empresa cliente demandante.',
      )
      expect(r.error).toContain('sem origem')
    }
  })

  it('INSERT aceito sem linha devolvida não vira "falhou" — o registro existe', async () => {
    respostas.set('companies', { data: null, error: null })
    const r = await cadastrarComercio({}, form())
    expect(r).toMatchObject({ ok: false })
    if ('error' in r && r.error) {
      expect(r.error).toContain('foi criado')
      expect(r.error).not.toContain('Não foi possível')
    }
    expect(inserts.map((i) => i.relacao)).toEqual(['companies'])
  })

  it('a bicondicional barra antes de escrever qualquer coisa', async () => {
    const r = await cadastrarComercio({}, form({ origemExigeEmpresa: 'false' }))
    expect(r).toMatchObject({ ok: false })
    expect(inserts).toHaveLength(0)
  })

  it('CNPJ duplicado vira mensagem própria, não a do Postgres', async () => {
    respostas.set('companies', {
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    })
    const r = await cadastrarComercio({}, form())
    if ('error' in r && r.error) expect(r.error).toContain('CNPJ')
  })
})
