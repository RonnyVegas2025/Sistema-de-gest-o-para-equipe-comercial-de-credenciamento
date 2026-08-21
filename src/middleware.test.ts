import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROFILE_HEADER, encodeProfile } from '@/lib/auth/profile-header'
import type { ProfileRow } from '@/types/database'

/**
 * Verificação obrigatória de D-019 e D-029 — `RLS_PERMISSOES.md` §6.3.
 *
 * O header `x-user-profile` é a ponte middleware → render, e o render confia
 * nele sem reconsultar `profiles`. Um valor forjado que sobreviva vira caminho
 * de escalonamento de papel.
 *
 * O sistema de origem saneia apenas no ramo de rota protegida com sessão, e
 * nunca escreveu este teste — nenhum dos 29 arquivos de teste da branch de
 * referência cobre §6.3. Por isso os casos de ROTA PÚBLICA e SEM SESSÃO estão
 * aqui: são justamente os que a origem deixa passar.
 *
 * O cliente Supabase é dublado. Estes casos são sobre o tratamento do header,
 * não sobre o banco — a fronteira de dados é a RLS, coberta pelos testes de
 * integração da etapa 9.
 */

const VITIMA: ProfileRow = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Consultora Comercial',
  email: 'consultora@vegascard.com.br',
  role: 'comercial',
  is_active: true,
  must_change_password: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

/** O que um atacante tentaria injetar: o mesmo id, papel de administrador. */
const FORJADO: ProfileRow = { ...VITIMA, role: 'administrador' }

let usuarioAtual: { id: string } | null = null
let perfilNoBanco: ProfileRow | null = null

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: async (_request: NextRequest, sanitizedHeaders: Headers) => {
    const { NextResponse } = await import('next/server')
    return {
      response: NextResponse.next({ request: { headers: sanitizedHeaders } }),
      user: usuarioAtual,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: perfilNoBanco }),
            }),
          }),
        }),
        auth: { signOut: async () => undefined },
      },
    }
  },
}))

async function executar(pathname: string, headers: Record<string, string>) {
  const { middleware } = await import('./middleware')
  const request = new NextRequest(`http://localhost:3000${pathname}`, {
    headers,
  })
  const response = await middleware(request)
  return response.headers.get('x-middleware-request-' + PROFILE_HEADER)
}

beforeEach(() => {
  vi.resetModules()
  usuarioAtual = null
  perfilNoBanco = null
})

describe('header de perfil forjado pelo cliente (§6.3)', () => {
  it('não sobrevive em rota protegida com sessão', async () => {
    usuarioAtual = { id: VITIMA.id }
    perfilNoBanco = VITIMA

    const recebido = await executar('/inicio', {
      [PROFILE_HEADER]: encodeProfile(FORJADO),
    })

    expect(recebido).not.toBeNull()
    const efetivo = JSON.parse(decodeURIComponent(recebido!)) as ProfileRow
    // O papel que chega ao render é o do banco, não o injetado.
    expect(efetivo.role).toBe('comercial')
    expect(efetivo.role).not.toBe('administrador')
  })

  it('não sobrevive em ROTA PÚBLICA que lê perfil — o caso que a origem deixa passar', async () => {
    // /dev é público no middleware, e o layout do segmento exige administrador.
    // Se o header atravessasse, o gate seria contornável com um curl.
    usuarioAtual = null

    const recebido = await executar('/dev/componentes', {
      [PROFILE_HEADER]: encodeProfile(FORJADO),
    })

    expect(recebido ?? '').not.toContain('administrador')
  })

  it('não sobrevive sem sessão nenhuma', async () => {
    usuarioAtual = null

    const recebido = await executar('/login', {
      [PROFILE_HEADER]: encodeProfile(FORJADO),
    })

    expect(recebido ?? '').not.toContain('administrador')
  })

  it('não sobrevive em rota protegida quando o perfil não existe no banco', async () => {
    usuarioAtual = { id: VITIMA.id }
    perfilNoBanco = null

    const recebido = await executar('/inicio', {
      [PROFILE_HEADER]: encodeProfile(FORJADO),
    })

    expect(recebido ?? '').not.toContain('administrador')
  })
})

describe('perfil legítimo', () => {
  it('chega ao render quando o cliente não manda nada', async () => {
    usuarioAtual = { id: VITIMA.id }
    perfilNoBanco = VITIMA

    const recebido = await executar('/inicio', {})

    expect(recebido).not.toBeNull()
    const efetivo = JSON.parse(decodeURIComponent(recebido!)) as ProfileRow
    expect(efetivo.id).toBe(VITIMA.id)
    expect(efetivo.role).toBe('comercial')
  })
})

describe('ordem das operações', () => {
  it('o delete precede o set no código-fonte', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const fonte = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

    const posDelete = fonte.indexOf(`delete(PROFILE_HEADER)`)
    const posSet = fonte.indexOf(`set(PROFILE_HEADER`)

    expect(posDelete).toBeGreaterThan(-1)
    expect(posSet).toBeGreaterThan(-1)
    expect(posDelete).toBeLessThan(posSet)
  })

  it('o saneamento vem antes da chamada a updateSession', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const fonte = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

    expect(fonte.indexOf('delete(PROFILE_HEADER)')).toBeLessThan(
      fonte.indexOf('await updateSession('),
    )
  })

  it('nada entre createServerClient e getUser() — a renovação do token depende disso', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const fonte = readFileSync(
      join(process.cwd(), 'src/lib/supabase/middleware.ts'),
      'utf8',
    )

    // Recorte entre o fim da construção do cliente e o await do getUser.
    const fimDoCliente = fonte.indexOf(
      '  )\n',
      fonte.indexOf('createServerClient<Database>'),
    )
    const inicioDoGetUser = fonte.indexOf('await supabase.auth.getUser()')
    const trecho = fonte.slice(fimDoCliente, inicioDoGetUser)

    expect(fimDoCliente).toBeGreaterThan(-1)
    expect(inicioDoGetUser).toBeGreaterThan(fimDoCliente)

    // Só pode haver o comentário que explica a regra e a desestruturação do
    // retorno. Nenhum await, nenhuma outra chamada ao supabase, nenhum if.
    const codigo = trecho
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith('//'))
      .join(' ')

    expect(codigo).not.toContain('await')
    expect(codigo).not.toContain('supabase.')
    expect(codigo).not.toContain('if ')
  })
})
