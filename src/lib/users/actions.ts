'use server'

import { revalidatePath } from 'next/cache'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { canWrite } from '@/lib/permissions/can'
import {
  criarUsuarioSchema,
  definirAcessoSchema,
  regenerarSenhaSchema,
} from '@/lib/validations/users'

/**
 * Server Actions da tela de usuários. Elas **invocam** a Edge Function
 * `admin-create-user`; não criam usuário por conta própria.
 *
 * A separação é o ponto: a service role vive apenas nos secrets da Edge
 * Function (D-030). Este arquivo roda no runtime do Next e nunca a vê — o que
 * ele envia é o JWT do próprio chamador, que o `createClient()` já carrega dos
 * cookies da sessão.
 *
 * **A revalidação de papel aqui é a segunda camada, não a barreira.** A
 * terceira — dentro da Edge Function — é a única que não dá para contornar
 * chamando a API direto, e é ela que decide de verdade. O `canWrite` abaixo
 * existe para a tela responder `forbidden` em vez de esperar um 403 vindo da
 * rede, não para autorizar coisa alguma.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A SENHA TEMPORÁRIA SÓ APARECE NO CAMINHO DE SUCESSO.
 *
 * Nenhum retorno de erro carrega `password`, e nada aqui a escreve em log —
 * nem em `console.error` de caminho de falha, que é justamente onde ela vazaria
 * sem ninguém perceber. O tipo `UsuarioState` é uma união discriminada por
 * `ok` para que isso não dependa de disciplina: o ramo de erro não tem o campo.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type UsuarioState =
  | { ok: true; password: string; email: string }
  | { ok: false; error: string; campos?: Record<string, string> }
  | Record<string, never>

/** Mensagens por código devolvido pela Edge Function. */
const MENSAGENS: Record<string, string> = {
  email_exists: 'Já existe um usuário com este e-mail.',
  forbidden: 'Somente administradores podem criar usuários.',
  no_session: 'Sessão expirada. Entre novamente.',
  invalid_payload: 'Dados inválidos. Confira os campos.',
  not_found: 'Usuário não encontrado.',
  missing_env:
    'A função de criação de usuários está sem configuração. Procure o responsável técnico.',
  invite_failed: 'Não foi possível enviar o convite por e-mail.',
}

const ERRO_GENERICO =
  'Não foi possível concluir a operação. Tente novamente em instantes.'

/**
 * Extrai o código de erro do corpo da resposta da Edge Function.
 *
 * `functions.invoke` devolve o erro como `FunctionsHttpError`, com a `Response`
 * crua em `context` — o código útil (`email_exists`, `forbidden`) está no corpo,
 * não na mensagem. Falha de rede não é `FunctionsHttpError` e não tem corpo:
 * devolve `null`, e o chamador cai na mensagem genérica.
 */
async function codigoDoErro(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null
  try {
    const corpo: unknown = await error.context.json()
    if (
      corpo &&
      typeof corpo === 'object' &&
      'error' in corpo &&
      typeof (corpo as { error: unknown }).error === 'string'
    ) {
      return (corpo as { error: string }).error
    }
  } catch {
    // Corpo ausente ou não-JSON. Genérico serve.
  }
  return null
}

function mensagemDe(codigo: string | null): string {
  if (!codigo) return ERRO_GENERICO
  return MENSAGENS[codigo] ?? ERRO_GENERICO
}

export async function criarUsuario(
  _prevState: UsuarioState,
  formData: FormData,
): Promise<UsuarioState> {
  const profile = await requireProfile()
  if (!canWrite(profile.role, 'usuarios')) {
    return { ok: false, error: MENSAGENS.forbidden! }
  }

  const parsed = criarUsuarioSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    const campos: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const campo = issue.path[0]
      if (typeof campo === 'string' && !campos[campo]) {
        campos[campo] = issue.message
      }
    }
    return { ok: false, error: 'Confira os campos destacados.', campos }
  }

  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke<{
    id: string
    password?: string
    invited?: boolean
  }>('admin-create-user', {
    body: { action: 'create', ...parsed.data },
  })

  if (error) {
    return { ok: false, error: mensagemDe(await codigoDoErro(error)) }
  }

  // Convite por e-mail (USER_INVITE_EMAIL_ENABLED) não devolve senha. Hoje o
  // padrão é senha temporária; se um dia o convite for ligado, a ausência de
  // senha é resposta legítima e não pode virar erro.
  if (!data?.password) {
    return {
      ok: false,
      error: 'Usuário criado. As instruções foram enviadas por e-mail.',
    }
  }

  revalidatePath('/usuarios')
  return { ok: true, password: data.password, email: parsed.data.email }
}

export async function regenerarSenha(
  _prevState: UsuarioState,
  formData: FormData,
): Promise<UsuarioState> {
  const profile = await requireProfile()
  if (!canWrite(profile.role, 'usuarios')) {
    return { ok: false, error: MENSAGENS.forbidden! }
  }

  const parsed = regenerarSenhaSchema.safeParse({
    userId: formData.get('userId'),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Usuário inválido.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke<{
    id: string
    password?: string
  }>('admin-create-user', {
    body: { action: 'regenerate', userId: parsed.data.userId },
  })

  if (error) {
    return { ok: false, error: mensagemDe(await codigoDoErro(error)) }
  }
  if (!data?.password) {
    return { ok: false, error: ERRO_GENERICO }
  }

  revalidatePath('/usuarios')
  return {
    ok: true,
    password: data.password,
    email: String(formData.get('email') ?? ''),
  }
}

export type AcessoState =
  | { ok: true; mensagem: string }
  | { ok: false; error: string }
  | Record<string, never>

/**
 * Liga e desliga o acesso de um usuário — `profiles.is_active`.
 *
 * Por D-036 isto é **encerramento operacional**, não inativação: a pessoa saiu
 * ou perdeu o acesso, e o registro continua válido. Ela permanece resolvível
 * como autora das linhas que criou e em `inactivated_by` / `ended_by`. Reativar
 * é operação normal e não passa pelo rito de D-025, escrito para reverter erro
 * de cadastro.
 *
 * Não usa Edge Function: não precisa de service role. É `UPDATE` em `profiles`,
 * e a RLS já restringe quem escreve.
 *
 * **Recebe o estado alvo, não um "alternar".** Um toggle decide a partir do que
 * a tela acredita; com a lista desatualizada — outra aba, outro administrador —
 * ele inverte o valor errado. `ativo: false` significa *deixe desativado*, e é
 * idempotente.
 */
export async function definirAcesso(
  _prevState: AcessoState,
  formData: FormData,
): Promise<AcessoState> {
  const profile = await requireProfile()

  // `canWrite` e não `canInactivate`: por D-036 esta ação não é inativação.
  // Hoje as duas capacidades resolvem para administrador, então a escolha não
  // muda comportamento — muda o que o código afirma estar fazendo.
  if (!canWrite(profile.role, 'usuarios')) {
    return { ok: false, error: MENSAGENS.forbidden! }
  }

  const parsed = definirAcessoSchema.safeParse({
    userId: formData.get('userId'),
    ativo: formData.get('ativo'),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Usuário inválido.' }
  }

  // ──────────────────────────────────────────────────────────────────────
  // O administrador não desativa a si mesmo.
  //
  // É o caminho mais rápido para o projeto perder o acesso administrativo: a
  // recuperação seria pelo painel de Auth, à mão. A tela também esconde a ação
  // na própria linha, mas **esconder botão não é autorizar** — quem chama a
  // action direto não vê botão nenhum. Mesma lógica de D-019 e da camada 3b.
  //
  // A checagem vem ANTES de qualquer escrita, e não depois: recusar depois do
  // UPDATE seria recusar tarde demais.
  // ──────────────────────────────────────────────────────────────────────
  if (parsed.data.userId === profile.id) {
    return {
      ok: false,
      error:
        'Você não pode desativar o próprio acesso. Peça a outro administrador.',
    }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.ativo })
    .eq('id', parsed.data.userId)

  if (error) {
    return { ok: false, error: ERRO_GENERICO }
  }

  revalidatePath('/usuarios')
  return {
    ok: true,
    mensagem: parsed.data.ativo
      ? 'Acesso reativado.'
      : 'Acesso desativado. A sessão cai no próximo request.',
  }
}
