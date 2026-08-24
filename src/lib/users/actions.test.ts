import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { FunctionsHttpError, FunctionsFetchError } from '@supabase/supabase-js'

const invoke = vi.fn()
const requireProfile = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ functions: { invoke } }),
}))
vi.mock('@/lib/auth/session', () => ({
  requireProfile: () => requireProfile(),
}))

const { criarUsuario, regenerarSenha } = await import('./actions')

/**
 * Sentinela: qualquer aparição desta string fora do caminho de sucesso é
 * vazamento. É um valor improvável de propósito, para que a varredura por
 * substring não dê falso positivo.
 */
const SENHA = 'S3nh4-T3mp0r4r14-#SENTINELA#'

const ADMIN = { id: 'a1', role: 'administrador', is_active: true }
const CONSULTOR = { id: 'c1', role: 'comercial', is_active: true }

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
