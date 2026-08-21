import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './form-field'
import { Input } from './input'

/**
 * Trava as correções do UI Standard §3.1 que valem para a biblioteca inteira.
 * Sem isto elas seriam convenção — e convenção não sobrevive à próxima cópia.
 */

// Varre ui/ E layout/: a correção 4 vale para a biblioteca inteira, e o shell
// chegou na etapa 4 trazendo as 9 ocorrências que faltavam.
const DIRS = ['src/components/ui', 'src/components/layout']
const sources = DIRS.flatMap((dir) => {
  const abs = join(process.cwd(), dir)
  return readdirSync(abs)
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map(
      (f) =>
        [
          `${dir.split('/').pop()}/${f}`,
          readFileSync(join(abs, f), 'utf8'),
        ] as const,
    )
})

describe('rótulo sempre visível (§3.1, §12)', () => {
  it('FormField renderiza o rótulo associado ao controle', () => {
    render(
      <FormField id="razao-social" label="Razão social">
        <Input placeholder="Digite a razão social" />
      </FormField>,
    )
    expect(screen.getByLabelText('Razão social')).toBeInTheDocument()
  })

  it('o rótulo continua visível quando há placeholder', () => {
    render(
      <FormField id="cnpj" label="CNPJ">
        <Input placeholder="00.000.000/0000-00" />
      </FormField>,
    )
    // Não basta o nome acessível: o texto tem de estar na tela. Placeholder
    // como único rótulo desaparece assim que o usuário digita.
    expect(screen.getByText('CNPJ')).toBeVisible()
  })

  it('marca campo obrigatório sem depender só de cor', () => {
    render(
      <FormField id="email" label="E-mail" required>
        <Input />
      </FormField>,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })
})

describe('nomenclatura de texto (§3.1)', () => {
  it.each(sources)('%s não usa ink-muted', (_file, source) => {
    // Nome ambíguo: não dizia se o texto era hierarquia secundária ou apoio.
    // Substituído por ink-secondary (prosa subordinada) e muted (metadado).
    expect(source).not.toContain('ink-muted')
  })
})

describe('alvo de toque responsivo (D-027)', () => {
  it.each([
    ['ui/button.tsx', 'h-11'],
    ['ui/input.tsx', 'h-11'],
    ['ui/select.tsx', 'h-11'],
  ])('%s tem 44 px na base', (file, expected) => {
    const source = sources.find(([name]) => name === file)?.[1] ?? ''
    expect(source).toContain(expected)
  })

  it('a densidade compacta é reintroduzida a partir de lg', () => {
    const button = sources.find(([name]) => name === 'ui/button.tsx')?.[1] ?? ''
    expect(button).toContain('lg:h-10')
  })
})
