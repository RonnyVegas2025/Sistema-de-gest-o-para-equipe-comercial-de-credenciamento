import { describe, expect, it, vi, beforeEach } from 'vitest'
import type * as ReactDom from 'react-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  ComercioLinha,
  ContadoresComercios,
} from '@/lib/comercios/queries'

/**
 * Cobre as invariantes do INDICADOR DE EXCEÇÃO, que é o que esta tela tem de
 * próprio (D-042, decisão 6):
 *
 *   1. o contador aparece mesmo em zero;
 *   2. "sem responsável" fica AUSENTE para quem não distribui — não zerado;
 *   3. clicar filtra, e o número NÃO muda.
 *
 * O diálogo de cadastro não é exercitado aqui pelo mesmo motivo da tela de
 * usuários: `useFormState` com action-função depende do suporte a form actions
 * que o Next embarca e o `react-dom` do `node_modules` não tem.
 */
const push = vi.fn()
let query = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query),
}))
vi.mock('@/lib/comercios/actions', () => ({ cadastrarComercio: vi.fn() }))

// `useFormState` com action-função depende do suporte a form actions que o Next
// embarca; o `react-dom` do `node_modules` não tem. Dublar aqui mantém o
// diálogo montável sem trazer dependência nova — a semântica do descarte de
// feedback está provada em `use-feedback-descartavel.test.tsx`.
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDom>()
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
    useFormState: (_acao: unknown, inicial: unknown) => [inicial, () => {}],
  }
})

const { ComerciosClient } = await import('./comercios-client')

const LINHA: ComercioLinha = {
  relationshipId: 'r1',
  companyId: 'c1',
  razaoSocial: 'Padaria do Bairro Ltda',
  nomeFantasia: null,
  cnpj: '11222333000181',
  municipio: 'Belo Horizonte',
  uf: 'MG',
  responsavelId: null,
  responsavelNome: null,
  temOrigem: false,
  cadastradoEm: '2026-08-01T00:00:00Z',
}

function montar(
  contadores: Partial<ContadoresComercios> = {},
  over: Partial<Parameters<typeof ComerciosClient>[0]> = {},
) {
  return render(
    <ComerciosClient
      contadores={{
        total: 10,
        semOrigem: 3,
        semResponsavel: { seAplica: false },
        ...contadores,
      }}
      linhas={[LINHA]}
      totalFiltrado={1}
      origens={[]}
      filtros={{ apenasSemOrigem: false, pagina: 1 }}
      podeCadastrar
      {...over}
    />,
  )
}

beforeEach(() => {
  push.mockReset()
  query = ''
})

describe('indicador de exceção', () => {
  it('exibe zero como zero — sumir ensinaria que ausência é "não medido"', () => {
    montar({ semOrigem: 0 })
    const rotulo = screen.getByText('Sem origem registrada')
    expect(rotulo.parentElement?.parentElement?.textContent).toContain('0')
  })

  it('para quem não distribui, "sem responsável" fica AUSENTE, não zerado', () => {
    montar({ semResponsavel: { seAplica: false } })
    expect(screen.queryByText('Sem responsável atribuído')).toBeNull()
  })

  it('para a gestão, "sem responsável" aparece', () => {
    montar({ semResponsavel: { seAplica: true, valor: 4 } })
    expect(screen.getByText('Sem responsável atribuído')).toBeTruthy()
  })

  it('clicar filtra e o NÚMERO NÃO MUDA — é isso que separa monitor de filtro', async () => {
    montar({ semOrigem: 3 })
    const antes = screen.getByText('3').textContent
    await userEvent.click(screen.getByText('Sem origem registrada'))
    expect(push).toHaveBeenCalledWith(expect.stringContaining('sem_origem=1'))
    // O componente não recalcula nada no clique: o número vem do servidor,
    // sobre o escopo inteiro, e a navegação é que traz a lista filtrada.
    expect(screen.getByText('3').textContent).toBe(antes)
  })

  it('mudar de filtro volta para a primeira página', async () => {
    query = 'pagina=4'
    montar()
    await userEvent.click(screen.getByText('Sem origem registrada'))
    expect(push).toHaveBeenCalledWith(expect.not.stringContaining('pagina='))
  })
})

describe('lista', () => {
  it('marca visualmente o comércio sem origem', () => {
    montar()
    expect(screen.getByText('Sem origem')).toBeTruthy()
  })

  it('mostra "Sem responsável" na linha em vez de vazio', () => {
    montar()
    // Rótulo do contador é distinto do texto da célula de propósito: iguais,
    // um `getByText` acha os dois — e na tela o usuário também confunde
    // "quantos existem" com "quem é o desta linha".
    expect(screen.getByText('Sem responsável')).toBeTruthy()
  })
})
