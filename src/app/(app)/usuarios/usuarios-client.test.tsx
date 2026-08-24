import { describe, expect, it, vi } from 'vitest'
import type * as ReactDom from 'react-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Cobre a FIAÇÃO do descarte de feedback na tela: que abrir e fechar diálogo
 * realmente encerra a mensagem pendente.
 *
 * A submissão real não é exercitada aqui, e é bom dizer por quê: `useFormState`
 * com action-função depende do suporte a form actions do React que o Next
 * embarca, e o `react-dom` do `node_modules` não tem — um teste por submissão
 * exigiria dependência nova. A semântica do descarte está provada em
 * `src/hooks/use-feedback-descartavel.test.tsx`; aqui se prova que a tela a usa.
 *
 * `useFormState` é dublado devolvendo SEMPRE o mesmo objeto de erro. Isso é
 * fiel ao defeito original: o estado fica pendurado, e só o descarte o remove.
 */
const ERRO = {
  ok: false as const,
  error: 'Seu perfil não permite gerar nova senha. Recusado pela aplicação.',
}

vi.mock('@/lib/users/actions', () => ({
  criarUsuario: vi.fn(),
  regenerarSenha: vi.fn(),
  definirAcesso: vi.fn(),
}))

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDom>()
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
    useFormState: (_acao: unknown, inicial: unknown) => [
      // Só o fluxo de "gerar nova senha" carrega erro pendurado.
      inicial === undefined ? inicial : ERRO,
      () => {},
    ],
  }
})

const { UsuariosClient } = await import('./usuarios-client')

const USUARIOS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    full_name: 'Admin do Gate',
    email: 'admin@vegascard.com.br',
    role: 'administrador' as const,
    is_active: true,
    must_change_password: false,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    full_name: 'Consultor do Gate',
    email: 'consultor@vegascard.com.br',
    role: 'comercial' as const,
    is_active: true,
    must_change_password: false,
  },
]

const MEU_ID = USUARIOS[0]!.id

describe('feedback pendurado na tela de usuários', () => {
  it('a mensagem de erro aparece enquanto não for descartada', () => {
    render(<UsuariosClient usuarios={USUARIOS} meuId={MEU_ID} />)

    expect(screen.getAllByText(ERRO.error).length).toBeGreaterThan(0)
  })

  it('abrir e fechar o diálogo de novo usuário encerra a mensagem', async () => {
    const user = userEvent.setup()
    render(<UsuariosClient usuarios={USUARIOS} meuId={MEU_ID} />)

    expect(screen.getAllByText(ERRO.error).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /novo usuário/i }))
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByText(ERRO.error)).not.toBeInTheDocument()
  })

  it('abrir e fechar a confirmação de acesso também encerra a mensagem', async () => {
    const user = userEvent.setup()
    render(<UsuariosClient usuarios={USUARIOS} meuId={MEU_ID} />)

    expect(screen.getAllByText(ERRO.error).length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: /desativar/i })[0]!)
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByText(ERRO.error)).not.toBeInTheDocument()
  })
})
