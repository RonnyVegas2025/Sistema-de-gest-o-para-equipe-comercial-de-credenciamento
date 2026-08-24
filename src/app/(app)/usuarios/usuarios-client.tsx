'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { KeyRound, UserPlus } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  FieldError,
  FormField,
  Input,
  Modal,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { ALL_ROLES, ROLES } from '@/lib/permissions/roles'
import {
  criarUsuario,
  regenerarSenha,
  type UsuarioState,
} from '@/lib/users/actions'
import type { UsuarioLinha } from '@/lib/users/queries'
import { NovaSenhaDialog } from './nova-senha-dialog'

const estadoInicial: UsuarioState = {}

const OPCOES_PAPEL = ALL_ROLES.map((role) => ({
  value: role,
  label: ROLES[role].label,
}))

function BotaoSubmit({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending}>
      {children}
    </Button>
  )
}

function campoDe(state: UsuarioState, nome: string): string | undefined {
  return 'campos' in state ? state.campos?.[nome] : undefined
}

function erroDe(state: UsuarioState): string | undefined {
  return 'ok' in state && state.ok === false ? state.error : undefined
}

/**
 * Tabela de usuários e os dois formulários que falam com a Edge Function.
 *
 * A senha temporária que volta no estado de sucesso **não é renderizada aqui**:
 * é entregue ao `NovaSenhaDialog`, que a mostra uma vez. Manter esse caminho
 * único é o que impede a senha de aparecer numa linha da tabela ou num toast.
 *
 * O gate de papel já aconteceu no Server Component; este componente não decide
 * permissão — a Server Action revalida, e a Edge Function decide de verdade.
 */
export function UsuariosClient({ usuarios }: { usuarios: UsuarioLinha[] }) {
  const [formAberto, setFormAberto] = useState(false)
  const [criarState, criarAction] = useFormState(criarUsuario, estadoInicial)
  const [senhaState, senhaAction] = useFormState(regenerarSenha, estadoInicial)

  // Qualquer um dos dois fluxos que devolva senha abre o mesmo diálogo.
  const sucesso =
    'ok' in criarState && criarState.ok
      ? criarState
      : 'ok' in senhaState && senhaState.ok
        ? senhaState
        : null

  const [senhaFechada, setSenhaFechada] = useState<string | null>(null)
  const mostrarSenha = sucesso && sucesso.password !== senhaFechada

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setFormAberto(true)}
          icon={<UserPlus className="h-4 w-4" />}
        >
          Novo usuário
        </Button>
      </div>

      {erroDe(senhaState) ? (
        <Alert variant="danger">{erroDe(senhaState)}</Alert>
      ) : null}

      {usuarios.length === 0 ? (
        <EmptyState
          title="Nenhum usuário cadastrado"
          description="Crie o primeiro usuário para liberar o acesso à plataforma."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nome</TH>
              <TH>E-mail</TH>
              <TH>Perfil</TH>
              <TH>Situação</TH>
              <TH>
                <span className="sr-only">Ações</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {usuarios.map((usuario) => (
              <TR key={usuario.id}>
                <TD>{usuario.full_name}</TD>
                <TD>{usuario.email}</TD>
                <TD>{ROLES[usuario.role].label}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={usuario.is_active ? 'success' : 'neutral'}>
                      {usuario.is_active ? 'Ativo' : 'Desativado'}
                    </Badge>
                    {usuario.must_change_password ? (
                      <Badge variant="warning">Troca pendente</Badge>
                    ) : null}
                  </div>
                </TD>
                <TD>
                  <form action={senhaAction} className="flex justify-end">
                    <input type="hidden" name="userId" value={usuario.id} />
                    <input type="hidden" name="email" value={usuario.email} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      icon={<KeyRound className="h-4 w-4" />}
                    >
                      Gerar nova senha
                    </Button>
                  </form>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        title="Novo usuário"
      >
        <form action={criarAction} className="flex flex-col gap-4" noValidate>
          <FormField
            id="full_name"
            label="Nome completo"
            required
            error={campoDe(criarState, 'full_name')}
          >
            <Input name="full_name" autoComplete="off" required />
          </FormField>

          <FormField
            id="email"
            label="E-mail"
            required
            error={campoDe(criarState, 'email')}
            hint="Será o login. O usuário recebe uma senha temporária."
          >
            <Input name="email" type="email" autoComplete="off" required />
          </FormField>

          <FormField
            id="role"
            label="Perfil de acesso"
            required
            error={campoDe(criarState, 'role')}
            hint={ROLES.comercial.description}
          >
            <Select
              name="role"
              options={OPCOES_PAPEL}
              defaultValue="comercial"
              required
            />
          </FormField>

          {erroDe(criarState) && !('campos' in criarState) ? (
            <FieldError id="criar-erro">{erroDe(criarState)}</FieldError>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFormAberto(false)}>
              Cancelar
            </Button>
            <BotaoSubmit>Criar usuário</BotaoSubmit>
          </div>
        </form>
      </Modal>

      {mostrarSenha && sucesso ? (
        <NovaSenhaDialog
          senha={sucesso.password}
          email={sucesso.email}
          onClose={() => {
            setSenhaFechada(sucesso.password)
            setFormAberto(false)
          }}
        />
      ) : null}
    </div>
  )
}
