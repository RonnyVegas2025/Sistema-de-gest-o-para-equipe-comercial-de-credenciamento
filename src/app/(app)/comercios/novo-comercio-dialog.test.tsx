import { describe, expect, it, vi, beforeEach } from 'vitest'
import type * as ReactDom from 'react-dom'
import { render, screen } from '@testing-library/react'
import type { ComercioState } from '@/lib/comercios/actions'

/**
 * Reprodução do defeito relatado em 31/08/2026: cadastro manual não dá retorno
 * nenhum, e o select de origem volta sozinho para "Selecione a origem".
 *
 * A causa está no efeito de reset do diálogo, que depende de `descartar` —
 * cuja identidade muda a CADA mudança de estado, porque o `useCallback` do
 * hook tem `[state]` na lista. Sequência:
 *
 *   1. a action devolve erro           `estado` muda
 *   2. `descartar` ganha nova identidade
 *   3. o efeito `[aberto, descartar]` roda de novo
 *   4. `descartar()` esconde o erro que acabou de chegar
 *   5. `setOrigemId('')` zera o select
 *
 * Um mecanismo, os dois sintomas. E o comentário no efeito dizia
 * "`descartar` é estável por `useCallback`", que é falso — foi essa afirmação
 * não medida que deixou o defeito passar.
 */
const ERRO: ComercioState = {
  ok: false,
  error: 'Confira os campos destacados.',
  campos: { responsavelId: 'Selecione o consultor' },
}
const VAZIO: ComercioState = {}

let estadoAtual: ComercioState = VAZIO

vi.mock('@/lib/comercios/actions', () => ({ cadastrarComercio: vi.fn() }))
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDom>()
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
    useFormState: () => [estadoAtual, () => {}],
  }
})

const { NovoComercioDialog } = await import('./novo-comercio-dialog')

const ORIGENS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    match_key: 'EMPRESA_CLIENTE',
    name: 'Empresa cliente',
    requires_client_company: true,
  },
]

beforeEach(() => {
  estadoAtual = VAZIO
})

describe('retorno do cadastro', () => {
  it('a recusa da action APARECE na tela', () => {
    const { rerender } = render(
      <NovoComercioDialog aberto onFechar={() => {}} origens={ORIGENS} />,
    )
    // A action responde: o estado passa a ser o erro.
    estadoAtual = ERRO
    rerender(
      <NovoComercioDialog aberto onFechar={() => {}} origens={ORIGENS} />,
    )

    expect(screen.queryByText('Confira os campos destacados.')).not.toBeNull()
  })

  it('o erro por campo APARECE junto do campo', () => {
    const { rerender } = render(
      <NovoComercioDialog aberto onFechar={() => {}} origens={ORIGENS} />,
    )
    estadoAtual = ERRO
    rerender(
      <NovoComercioDialog aberto onFechar={() => {}} origens={ORIGENS} />,
    )

    expect(screen.queryByText('Selecione o consultor')).not.toBeNull()
  })

  it('reabrir o diálogo encerra o feedback anterior (D-037)', () => {
    estadoAtual = ERRO
    const { rerender } = render(
      <NovoComercioDialog aberto onFechar={() => {}} origens={ORIGENS} />,
    )
    rerender(
      <NovoComercioDialog
        aberto={false}
        onFechar={() => {}}
        origens={ORIGENS}
      />,
    )
    rerender(
      <NovoComercioDialog aberto onFechar={() => {}} origens={ORIGENS} />,
    )

    expect(screen.queryByText('Confira os campos destacados.')).toBeNull()
  })
})
