import { describe, expect, it, vi, beforeEach } from 'vitest'
import type * as ReactDom from 'react-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComercioState } from '@/lib/comercios/actions'
import type { ComercioLinha } from '@/lib/comercios/queries'

/**
 * Regressão do defeito de 31/08/2026: cadastro manual sem retorno nenhum.
 *
 * Duas causas, uma dentro da outra.
 *
 * **1 · `descartar` de identidade instável.** O `useCallback` do hook fechava
 * sobre o estado, e o efeito de reset do diálogo o tinha nas dependências —
 * então ele disparava a cada resposta do servidor em vez de na abertura,
 * escondendo o erro que acabava de chegar e zerando o select junto. Coberto
 * também em `use-feedback-descartavel.test.tsx`, no nível do hook.
 *
 * **2 · o estado do envio morava no diálogo.** Mesmo exibido, o retorno sumia
 * junto com o modal. Não saber se salvou é pior que mensagem errada: o usuário
 * tenta de novo e bate no índice único de CNPJ, recebendo erro de duplicidade
 * sobre um registro que ele mesmo criou.
 *
 * Por isso os casos abaixo medem a PÁGINA, e não o diálogo — foi para lá que a
 * invariante mudou.
 */
const ERRO: ComercioState = {
  ok: false,
  error: 'Confira os campos destacados.',
  campos: { responsavelId: 'Selecione o consultor' },
}
const OK: ComercioState = { ok: true, companyId: 'c-1' }
const VAZIO: ComercioState = {}

let estadoAtual: ComercioState = VAZIO
const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/lib/comercios/actions', () => ({ cadastrarComercio: vi.fn() }))
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDom>()
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
    useFormState: () => [estadoAtual, () => {}],
  }
})

const { ComerciosClient } = await import('./comercios-client')

const ORIGENS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    match_key: 'EMPRESA_CLIENTE',
    name: 'Empresa cliente',
    requires_client_company: true,
  },
]
const LINHA: ComercioLinha = {
  relationshipId: 'r1',
  companyId: 'c1',
  razaoSocial: 'Padaria do Bairro Ltda',
  nomeFantasia: null,
  cnpj: '11222333000181',
  municipio: null,
  uf: null,
  responsavelId: null,
  responsavelNome: null,
  temOrigem: false,
  cadastradoEm: '2026-08-01T00:00:00Z',
}

function tela() {
  return (
    <ComerciosClient
      contadores={{
        total: 1,
        semOrigem: 1,
        semResponsavel: { seAplica: false },
      }}
      linhas={[LINHA]}
      totalFiltrado={1}
      origens={ORIGENS}
      filtros={{ apenasSemOrigem: false, pagina: 1 }}
      podeCadastrar
    />
  )
}

beforeEach(() => {
  estadoAtual = VAZIO
  push.mockReset()
})

describe('retorno do cadastro', () => {
  it('a recusa APARECE — não é engolida pelo reset', () => {
    const { rerender } = render(tela())
    estadoAtual = ERRO
    rerender(tela())
    expect(screen.queryByText('Confira os campos destacados.')).not.toBeNull()
  })

  it('a recusa aparece COM O DIÁLOGO FECHADO', () => {
    const { rerender } = render(tela())
    estadoAtual = ERRO
    rerender(tela())
    // Nenhum diálogo foi aberto nesta montagem. `queryByText` não serve aqui:
    // o botão que abre o modal tem o mesmo rótulo que o título dele.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('O comércio não foi cadastrado')).not.toBeNull()
  })

  it('o sucesso APARECE, para o usuário não tentar de novo', () => {
    const { rerender } = render(tela())
    estadoAtual = OK
    rerender(tela())
    expect(screen.queryByText('Comércio cadastrado')).not.toBeNull()
  })

  it('abrir o diálogo encerra o feedback anterior (D-037)', async () => {
    estadoAtual = ERRO
    render(tela())
    expect(screen.queryByText('Confira os campos destacados.')).not.toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: /novo comércio/i }),
    )
    expect(screen.queryByText('Confira os campos destacados.')).toBeNull()
  })

  it('o erro por campo fica ao lado do campo, dentro do diálogo', async () => {
    const { rerender } = render(tela())
    await userEvent.click(
      screen.getByRole('button', { name: /novo comércio/i }),
    )
    estadoAtual = ERRO
    rerender(tela())
    expect(screen.queryByText('Selecione o consultor')).not.toBeNull()
  })
})
