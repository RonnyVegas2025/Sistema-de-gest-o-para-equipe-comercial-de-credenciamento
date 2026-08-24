'use client'

import { useCallback, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
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
  definirAcesso,
  regenerarSenha,
  type AcessoState,
  type UsuarioState,
} from '@/lib/users/actions'
import type { UsuarioLinha } from '@/lib/users/queries'
import { useFeedbackDescartavel } from '@/hooks/use-feedback-descartavel'
import { NovaSenhaDialog } from './nova-senha-dialog'

const estadoInicial: UsuarioState = {}
const estadoInicialAcesso: AcessoState = {}

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
export function UsuariosClient({
  usuarios,
  meuId,
}: {
  usuarios: UsuarioLinha[]
  meuId: string
}) {
  const [formAberto, setFormAberto] = useState(false)
  const [alvo, setAlvo] = useState<UsuarioLinha | null>(null)
  const [criarBruto, criarAction] = useFormState(criarUsuario, estadoInicial)
  const [senhaBruto, senhaAction] = useFormState(regenerarSenha, estadoInicial)
  const [acessoBruto, acessoAction] = useFormState(
    definirAcesso,
    estadoInicialAcesso,
  )
  const acessoForm = useRef<HTMLFormElement>(null)

  // ────────────────────────────────────────────────────────────────────────
  // Os TRÊS estados são descartáveis, não só o da senha.
  //
  // `useFormState` guarda o último retorno e não oferece reset: uma mensagem
  // de erro fica na tela até uma nova submissão daquela mesma action. Quem vê
  // a tela associa a mensagem à última coisa que fez — e pode não ter relação.
  // Isso já custou uma rodada de investigação num bug desta tela.
  //
  // A regra é uma só: feedback pertence à interação que o produziu, e a
  // interação seguinte o encerra.
  // ────────────────────────────────────────────────────────────────────────
  const [criarState, descartarCriar] = useFeedbackDescartavel(
    criarBruto,
    estadoInicial,
  )
  const [senhaState, descartarSenha] = useFeedbackDescartavel(
    senhaBruto,
    estadoInicial,
  )
  const [acessoState, descartarAcesso] = useFeedbackDescartavel(
    acessoBruto,
    estadoInicialAcesso,
  )

  /** Toda abertura ou fechamento de diálogo encerra o feedback pendente. */
  const limparFeedback = useCallback(() => {
    descartarCriar()
    descartarSenha()
    descartarAcesso()
  }, [descartarCriar, descartarSenha, descartarAcesso])

  // Qualquer um dos dois fluxos que devolva senha abre o mesmo diálogo.
  const sucesso =
    'ok' in criarState && criarState.ok
      ? criarState
      : 'ok' in senhaState && senhaState.ok
        ? senhaState
        : null

  // Sem `senhaFechada`: o diálogo some porque o feedback foi descartado ao
  // fechar, não por um segundo controle paralelo ao estado.
  const mostrarSenha = sucesso !== null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            limparFeedback()
            setFormAberto(true)
          }}
          icon={<UserPlus className="h-4 w-4" />}
        >
          Novo usuário
        </Button>
      </div>

      {erroDe(senhaState) ? (
        <Alert variant="danger">{erroDe(senhaState)}</Alert>
      ) : null}

      {'ok' in acessoState && acessoState.ok === false ? (
        <Alert variant="danger">{acessoState.error}</Alert>
      ) : null}
      {'ok' in acessoState && acessoState.ok === true ? (
        <Alert variant="success">{acessoState.mensagem}</Alert>
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
                  <div className="flex flex-wrap justify-end gap-1">
                    <form action={senhaAction}>
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

                    {/*
                      A própria linha não oferece a ação: desativar o próprio
                      acesso é o caminho mais rápido para o projeto ficar sem
                      administrador. Esconder aqui é conveniência — a recusa
                      que vale está na Server Action, porque quem chama direto
                      não vê botão nenhum.
                    */}
                    {usuario.id === meuId ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          limparFeedback()
                          setAlvo(usuario)
                        }}
                        icon={
                          usuario.is_active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )
                        }
                      >
                        {usuario.is_active ? 'Desativar' : 'Reativar'}
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={formAberto}
        onClose={() => {
          limparFeedback()
          setFormAberto(false)
        }}
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
            <Button
              variant="secondary"
              onClick={() => {
                limparFeedback()
                setFormAberto(false)
              }}
            >
              Cancelar
            </Button>
            <BotaoSubmit>Criar usuário</BotaoSubmit>
          </div>
        </form>
      </Modal>

      {/*
        Um único form fora da tabela, submetido pelo diálogo. O alvo vai em
        campo escondido e `ativo` carrega o ESTADO ALVO, não um pedido de
        inversão — ver `definirAcesso`.
      */}
      <form action={acessoAction} ref={acessoForm} className="hidden">
        <input type="hidden" name="userId" value={alvo?.id ?? ''} />
        <input
          type="hidden"
          name="ativo"
          value={alvo?.is_active ? 'false' : 'true'}
        />
      </form>

      <ConfirmDialog
        open={alvo !== null}
        title={alvo?.is_active ? 'Desativar acesso' : 'Reativar acesso'}
        description={
          alvo?.is_active
            ? `${alvo.full_name} perde o acesso no próximo carregamento de página. O cadastro continua válido e o histórico continua contando.`
            : `${alvo?.full_name} volta a acessar a plataforma.`
        }
        confirmLabel={alvo?.is_active ? 'Desativar' : 'Reativar'}
        confirmVariant={alvo?.is_active ? 'destructive' : 'primary'}
        onClose={() => {
          limparFeedback()
          setAlvo(null)
        }}
        onConfirm={() => {
          acessoForm.current?.requestSubmit()
          setAlvo(null)
        }}
      />

      {mostrarSenha && sucesso ? (
        <NovaSenhaDialog
          senha={sucesso.password}
          email={sucesso.email}
          onClose={() => {
            limparFeedback()
            setFormAberto(false)
          }}
        />
      ) : null}
    </div>
  )
}
