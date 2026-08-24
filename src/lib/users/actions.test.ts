import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { FunctionsHttpError, FunctionsFetchError } from '@supabase/supabase-js'

const invoke = vi.fn()
const requireProfile = vi.fn()
const update = vi.fn()
const eq = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    functions: { invoke },
    from: () => ({
      update: (patch: unknown) => {
        update(patch)
        return { eq: (col: string, val: string) => eq(col, val) }
      },
    }),
  }),
}))
vi.mock('@/lib/auth/session', () => ({
  requireProfile: () => requireProfile(),
}))

const { criarUsuario, regenerarSenha, definirAcesso } =
  await import('./actions')

/**
 * Sentinela: qualquer aparição desta string fora do caminho de sucesso é
 * vazamento. É um valor improvável de propósito, para que a varredura por
 * substring não dê falso positivo.
 */
const SENHA = 'S3nh4-T3mp0r4r14-#SENTINELA#'

// UUIDs de verdade: o schema valida o formato antes da checagem de identidade,
// então um id inventado reprovaria pelo motivo errado e o teste passaria sem
// exercitar a recusa de auto-desativação.
const ADMIN = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'administrador',
  is_active: true,
}
const CONSULTOR = {
  id: '99999999-9999-4999-8999-999999999999',
  role: 'comercial',
  is_active: true,
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

const VALIDO = {
  full_name: 'Fulano de Tal',
  email: 'Fulano@VegasCard.com.br',
  role: 'comercial',
}

function respostaHttp(status: number, corpo: unknown): FunctionsHttpError {
  return new FunctionsHttpError(new Response(JSON.stringify(corpo), { status }))
}

beforeEach(() => {
  invoke.mockReset()
  requireProfile.mockReset()
  update.mockReset()
  eq.mockReset()
  eq.mockResolvedValue({ error: null })
  requireProfile.mockResolvedValue(ADMIN)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('criarUsuario — validação antes da rede', () => {
  it('não invoca a função com payload inválido', async () => {
    const state = await criarUsuario(
      {},
      form({ ...VALIDO, email: 'nao-e-email' }),
    )

    expect(invoke).not.toHaveBeenCalled()
    expect(state).toMatchObject({ ok: false })
    expect('campos' in state && state.campos?.email).toBeTruthy()
  })

  it('recusa papel fora do enum, em vez de empurrar o erro para o banco', async () => {
    const state = await criarUsuario({}, form({ ...VALIDO, role: 'chefe' }))

    expect(invoke).not.toHaveBeenCalled()
    expect('campos' in state && state.campos?.role).toBeTruthy()
  })

  it('normaliza o e-mail antes de enviar', async () => {
    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: null,
    })

    await criarUsuario({}, form(VALIDO))

    expect(invoke).toHaveBeenCalledWith('admin-create-user', {
      body: {
        action: 'create',
        full_name: 'Fulano de Tal',
        email: 'fulano@vegascard.com.br',
        role: 'comercial',
      },
    })
  })
})

describe('criarUsuario — a camada de aplicação recusa antes da rede', () => {
  it('um consultor não chega a invocar a função', async () => {
    requireProfile.mockResolvedValue(CONSULTOR)

    const state = await criarUsuario({}, form(VALIDO))

    expect(invoke).not.toHaveBeenCalled()
    expect(state).toMatchObject({ ok: false })
  })
})

describe('criarUsuario — erros da Edge Function viram mensagem, nunca sucesso', () => {
  it('409 email_exists', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: respostaHttp(409, { error: 'email_exists' }),
    })

    const state = await criarUsuario({}, form(VALIDO))

    expect(state).toMatchObject({ ok: false })
    expect('error' in state && state.error).toContain('Já existe')
  })

  it('403 forbidden — a barreira da própria função', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: respostaHttp(403, { error: 'forbidden' }),
    })

    const state = await criarUsuario({}, form(VALIDO))

    expect(state).toMatchObject({ ok: false })
    expect('error' in state && state.error).toContain('administradores')
  })

  it('500 missing_env não vira "tente novamente": é problema de configuração', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: respostaHttp(500, { error: 'missing_env', missing: ['X'] }),
    })

    const state = await criarUsuario({}, form(VALIDO))

    expect('error' in state && state.error).toContain('configuração')
  })

  it('falha de rede não tem corpo e cai na mensagem genérica', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError('fetch failed')),
    })

    const state = await criarUsuario({}, form(VALIDO))

    expect(state).toMatchObject({ ok: false })
    expect('error' in state && state.error).toContain('Tente novamente')
  })

  it('resposta sem senha não é tratada como sucesso silencioso', async () => {
    invoke.mockResolvedValue({ data: { id: 'u1' }, error: null })

    const state = await criarUsuario({}, form(VALIDO))

    expect(state).toMatchObject({ ok: false })
  })
})

describe('criarUsuario — sucesso', () => {
  it('devolve a senha temporária uma vez, com o e-mail normalizado', async () => {
    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: null,
    })

    const state = await criarUsuario({}, form(VALIDO))

    expect(state).toEqual({
      ok: true,
      password: SENHA,
      email: 'fulano@vegascard.com.br',
    })
  })
})

/**
 * A asserção que sustenta o desenho do diálogo próprio: se a senha escapar
 * para um caminho de erro, ela chega ao cliente por um estado que a tela não
 * espera esconder — e, pior, atravessa qualquer log de erro no meio.
 *
 * A varredura é por SUBSTRING no estado inteiro serializado, não por campo:
 * checar `state.password` só pegaria o vazamento que já sabemos nomear.
 */
describe('nenhum caminho de erro carrega a senha', () => {
  const CAMINHOS: [string, unknown][] = [
    ['409 email_exists', respostaHttp(409, { error: 'email_exists' })],
    ['403 forbidden', respostaHttp(403, { error: 'forbidden' })],
    ['401 no_session', respostaHttp(401, { error: 'no_session' })],
    [
      '500 sem corpo JSON',
      new FunctionsHttpError(new Response('boom', { status: 500 })),
    ],
    ['falha de rede', new FunctionsFetchError(new TypeError('fetch failed'))],
  ]

  it.each(CAMINHOS)('%s', async (_nome, erro) => {
    // O pior caso possível: a função devolve erro E uma senha no data. Se o
    // estado de erro copiasse `data`, o vazamento nasceria aqui.
    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: erro,
    })

    const state = await criarUsuario({}, form(VALIDO))

    expect(state).toMatchObject({ ok: false })
    expect(JSON.stringify(state)).not.toContain(SENHA)
    expect('password' in state).toBe(false)
  })

  it('payload inválido também não carrega senha', async () => {
    const state = await criarUsuario({}, form({ ...VALIDO, email: 'x' }))
    expect(JSON.stringify(state)).not.toContain(SENHA)
  })

  it('a senha nunca é escrita em console — nem no caminho de erro', async () => {
    const spies = [
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'log').mockImplementation(() => {}),
    ]

    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: respostaHttp(500, { error: 'create_failed' }),
    })
    await criarUsuario({}, form(VALIDO))

    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: null,
    })
    await criarUsuario({}, form(VALIDO))

    for (const spy of spies) {
      for (const chamada of spy.mock.calls) {
        expect(JSON.stringify(chamada)).not.toContain(SENHA)
      }
    }
  })
})

describe('regenerarSenha', () => {
  it('recusa id que não é uuid, sem tocar na rede', async () => {
    const state = await regenerarSenha({}, form({ userId: 'nao-e-uuid' }))

    expect(invoke).not.toHaveBeenCalled()
    expect(state).toMatchObject({ ok: false })
  })

  it('devolve a nova senha no sucesso', async () => {
    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: null,
    })

    const state = await regenerarSenha(
      {},
      form({
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'alguem@vegascard.com.br',
      }),
    )

    expect(state).toMatchObject({ ok: true, password: SENHA })
  })

  it('erro não carrega senha', async () => {
    invoke.mockResolvedValue({
      data: { id: 'u1', password: SENHA },
      error: respostaHttp(404, { error: 'not_found' }),
    })

    const state = await regenerarSenha(
      {},
      form({ userId: '11111111-1111-4111-8111-111111111111' }),
    )

    expect(JSON.stringify(state)).not.toContain(SENHA)
  })
})

/**
 * Etapa 1b. A asserção que sustenta o desenho está na primeira suíte: a recusa
 * de auto-desativação vive na Server Action, não na ausência do botão. Quem
 * chama a action direto não vê botão nenhum.
 */
describe('definirAcesso — o administrador não desativa a si mesmo', () => {
  const OUTRO = '22222222-2222-4222-8222-222222222222'

  it('recusa o próprio id — e NÃO emite o UPDATE', async () => {
    const state = await definirAcesso(
      {},
      form({ userId: ADMIN.id, ativo: 'false' }),
    )

    expect(state).toMatchObject({ ok: false })
    expect('error' in state && state.error).toContain('próprio acesso')
    // O ponto: a recusa acontece ANTES da escrita, não depois dela.
    expect(update).not.toHaveBeenCalled()
    expect(eq).not.toHaveBeenCalled()
  })

  it('recusa o próprio id mesmo quando o alvo é reativar', async () => {
    const state = await definirAcesso(
      {},
      form({ userId: ADMIN.id, ativo: 'true' }),
    )

    expect(state).toMatchObject({ ok: false })
    expect(update).not.toHaveBeenCalled()
  })

  it('desativa outro usuário normalmente', async () => {
    const state = await definirAcesso(
      {},
      form({ userId: OUTRO, ativo: 'false' }),
    )

    expect(update).toHaveBeenCalledWith({ is_active: false })
    expect(eq).toHaveBeenCalledWith('id', OUTRO)
    expect(state).toMatchObject({ ok: true })
  })
})

describe('definirAcesso — estado alvo, não alternância', () => {
  const OUTRO = '22222222-2222-4222-8222-222222222222'

  it("'false' vira false, e não 'string não vazia é true'", async () => {
    await definirAcesso({}, form({ userId: OUTRO, ativo: 'false' }))
    expect(update).toHaveBeenCalledWith({ is_active: false })
  })

  it("'true' vira true", async () => {
    await definirAcesso({}, form({ userId: OUTRO, ativo: 'true' }))
    expect(update).toHaveBeenCalledWith({ is_active: true })
  })

  it('recusa qualquer outro valor em vez de adivinhar', async () => {
    const state = await definirAcesso({}, form({ userId: OUTRO, ativo: 'sim' }))

    expect(state).toMatchObject({ ok: false })
    expect(update).not.toHaveBeenCalled()
  })

  it('reaplicar o mesmo alvo é idempotente, não inverte', async () => {
    await definirAcesso({}, form({ userId: OUTRO, ativo: 'false' }))
    await definirAcesso({}, form({ userId: OUTRO, ativo: 'false' }))

    expect(update).toHaveBeenNthCalledWith(1, { is_active: false })
    expect(update).toHaveBeenNthCalledWith(2, { is_active: false })
  })
})

describe('definirAcesso — papel e entrada', () => {
  it('um consultor não chega a escrever', async () => {
    requireProfile.mockResolvedValue(CONSULTOR)

    const state = await definirAcesso(
      {},
      form({ userId: '22222222-2222-4222-8222-222222222222', ativo: 'false' }),
    )

    expect(state).toMatchObject({ ok: false })
    expect(update).not.toHaveBeenCalled()
  })

  it('id que não é uuid não chega a escrever', async () => {
    const state = await definirAcesso({}, form({ userId: 'x', ativo: 'false' }))

    expect(state).toMatchObject({ ok: false })
    expect(update).not.toHaveBeenCalled()
  })

  it('erro do banco não vira sucesso', async () => {
    eq.mockResolvedValue({ error: { message: 'boom' } })

    const state = await definirAcesso(
      {},
      form({ userId: '22222222-2222-4222-8222-222222222222', ativo: 'false' }),
    )

    expect(state).toMatchObject({ ok: false })
  })
})
