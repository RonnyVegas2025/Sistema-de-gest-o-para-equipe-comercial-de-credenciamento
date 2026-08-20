import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Trava a correção de D-020 na etapa 1. O `next.config.mjs` é copiado do
 * repositório-base, que envia `geolocation=()` — com isso o navegador nega a
 * API antes de exibir o prompt, e o sintoma na tela fica indistinguível de
 * "usuário negou". O CRM registra visitas com geolocalização.
 *
 * `SPRINT-1.md` lista a cópia literal desse cabeçalho como risco da sprint,
 * com mitigação na etapa 1. Este teste é a mitigação.
 */
// vitest roda a partir da raiz do projeto; o ambiente jsdom não expõe
// import.meta.url como URL file:.
const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8')

function permissionsPolicy(): string {
  const match = config.match(
    /key:\s*'Permissions-Policy',\s*\n\s*value:\s*'([^']+)'/,
  )
  if (!match?.[1]) {
    throw new Error(
      'Cabeçalho Permissions-Policy não encontrado em next.config.mjs',
    )
  }
  return match[1]
}

describe('Permissions-Policy (D-020)', () => {
  it('libera geolocalização para a própria origem', () => {
    expect(permissionsPolicy()).toContain('geolocation=(self)')
  })

  it('mantém câmera e microfone desligados', () => {
    const policy = permissionsPolicy()
    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
  })
})

describe('demais cabeçalhos de segurança', () => {
  it('preserva os herdados do repositório-base', () => {
    expect(config).toContain("key: 'X-Frame-Options', value: 'DENY'")
    expect(config).toContain("key: 'X-Content-Type-Options', value: 'nosniff'")
    expect(config).toContain('strict-origin-when-cross-origin')
  })
})
