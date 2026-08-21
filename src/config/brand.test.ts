import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { brand } from './brand'

/**
 * Sincronia do espelho de tokens (UI Standard §3.1, quinta correção).
 *
 * `brand.colors` existe porque alguns consumidores não leem CSS: theme-color do
 * navegador, PDF, canvas, e-mail transacional. O risco é o espelho divergir da
 * fonte em silêncio — e `src/config/` fica fora da regra de lint que barra
 * hexadecimal, que só cobre `src/components` e `src/app`.
 *
 * Por isso a sincronia é teste, não convenção: tokens.css é lido e comparado
 * valor a valor. Trocar um token sem atualizar o espelho quebra aqui.
 */
const tokens = readFileSync(
  join(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

function token(name: string): string {
  const match = tokens.match(new RegExp(`--vg-${name}:\\s*([^;]+);`))
  if (!match?.[1]) {
    throw new Error(`Token --vg-${name} não encontrado em tokens.css`)
  }
  return match[1].trim()
}

/** O espelho está em maiúsculas; tokens.css, em minúsculas. */
const MIRROR: Array<[keyof typeof brand.colors, string]> = [
  ['primary', 'brand-500'],
  ['primaryStrong', 'brand-700'],
  ['primarySoft', 'brand-400'],
  ['secondaryRose', 'rose-400'],
  ['secondaryPeach', 'peach-400'],
  ['background', 'bg'],
  ['surface', 'surface'],
  ['border', 'border'],
  ['ink', 'ink'],
  ['muted', 'muted'],
]

describe('brand.colors espelha tokens.css', () => {
  it.each(MIRROR)('%s == --vg-%s', (mirrorKey, tokenName) => {
    expect(brand.colors[mirrorKey].toLowerCase()).toBe(
      token(tokenName).toLowerCase(),
    )
  })

  it('o gradiente usa as mesmas três paradas da fita oficial', () => {
    const gradient = brand.colors.gradient.toLowerCase()
    expect(gradient).toContain(token('brand-400').toLowerCase())
    expect(gradient).toContain(token('rose-400').toLowerCase())
    expect(gradient).toContain(token('peach-400').toLowerCase())
  })
})

describe('correções obrigatórias do UI Standard §3.1', () => {
  it('Peach 600 foi corrigido para contraste AA sobre Peach 50', () => {
    expect(token('peach-600').toLowerCase()).toBe('#9e5445')
  })

  it('existe --vg-border-field para borda de campo', () => {
    expect(token('border-field').toLowerCase()).toBe('#8e90ad')
  })
})
