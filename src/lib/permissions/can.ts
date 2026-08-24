import type { AppRole } from '@/types/database'
import { ALL_ROLES } from './roles'

/**
 * Módulos de navegação/rota do CRM. As permissões finas por registro vivem na
 * RLS do banco; este mapa é a camada de aplicação (menu, guarda de rota, gate
 * de formulário) — **conveniência, não a fronteira**.
 */
export type ModuleKey =
  | 'inicio'
  | 'minha_carteira'
  | 'oportunidades'
  | 'agenda'
  | 'visitas'
  | 'estabelecimentos'
  | 'contatos'
  | 'base_vegas'
  | 'carteiras'
  | 'importacoes'
  | 'produtos'
  | 'estrutura_comercial'
  | 'mapa'
  | 'atividades'
  | 'usuarios'
  | 'configuracoes'
  | 'auditoria'

/** L (read) · C/E (write) · X (inactivate) da matriz de RLS_PERMISSOES §3. */
export type Capability = 'read' | 'write' | 'inactivate'

/**
 * Espelho TypeScript de `docs/RLS_PERMISSOES.md` §3. A RLS (SQL) é a fronteira
 * real; a sincronia TS × RLS é **manual e é risco conhecido**. O mecanismo de
 * detecção são os testes de integração de §6, que fazem parte da definição de
 * pronto (D-018).
 *
 * Regra: todo módulo declara as TRÊS capacidades. Lista vazia `[]` é negação
 * explícita, não omissão — o `Record` completo não compila sem ela.
 *
 * As três funções são nomeadas e **sem argumento com valor padrão** (§3): um
 * parâmetro opcional que muda semântica de segurança falha para o lado errado.
 */
type PermissionMatrix = Record<
  ModuleKey,
  Record<Capability, readonly AppRole[]>
>

const ADMIN = ['administrador'] as const
const GESTAO = ['administrador', 'gestor_adm'] as const
const OPERACAO = [
  'administrador',
  'gestor_adm',
  'analista_adm',
  'comercial',
] as const
const OPERACAO_COM_AUDITORIA = [
  'administrador',
  'gestor_adm',
  'analista_adm',
  'comercial',
  'auditoria',
] as const
/** Operação sem o analista: carteira, agenda, visita e atividade são do campo. */
const CAMPO = ['administrador', 'gestor_adm', 'comercial'] as const

const MODULE_CAPABILITIES: PermissionMatrix = {
  // ————————————————————————————————————————————————————————————————
  // DECLARADO-NÃO-VALIDADO
  //
  // Toda a matriz nasce aqui: transcrita de §3, mas nenhuma linha foi conferida
  // contra RLS aplicada — na etapa 4 não existe banco. Não construir tela
  // confiando numa destas linhas sem revisá-la contra a policy da sprint
  // correspondente, e mover para um bloco VALIDADO ao fazê-lo.
  //
  // `inicio` é a única exceção prática: não tem dado por trás.
  // ————————————————————————————————————————————————————————————————
  inicio: { read: ALL_ROLES, write: [], inactivate: [] },

  minha_carteira: {
    read: OPERACAO,
    write: CAMPO,
    inactivate: [],
  },
  oportunidades: {
    read: OPERACAO_COM_AUDITORIA,
    write: OPERACAO,
    inactivate: ADMIN,
  },
  agenda: {
    read: OPERACAO,
    write: CAMPO,
    inactivate: [],
  },
  // Visita é atividade, e atividade é histórico (D-022): registro errado se
  // corrige por atividade nova, não some. Por isso não há inativação.
  visitas: {
    read: OPERACAO_COM_AUDITORIA,
    write: CAMPO,
    inactivate: [],
  },
  estabelecimentos: {
    read: ALL_ROLES,
    write: OPERACAO,
    inactivate: ADMIN,
  },
  // Contato é inativável pelo próprio consultor, no escopo dele: contato que
  // saiu da empresa é mudança natural, não erro de cadastro (§3).
  contatos: {
    read: OPERACAO,
    write: OPERACAO,
    inactivate: OPERACAO,
  },
  base_vegas: {
    read: OPERACAO_COM_AUDITORIA,
    write: CAMPO,
    inactivate: [],
  },
  // Carteira é instrumento de gestão comercial, não cadastro mestre — o gestor
  // inativa, via enforce_inactivation_is_manager_or_admin() (§5.7).
  carteiras: {
    read: ['administrador', 'gestor_adm', 'analista_adm', 'auditoria'],
    write: GESTAO,
    inactivate: GESTAO,
  },
  importacoes: {
    read: GESTAO,
    write: GESTAO,
    inactivate: [],
  },
  // Catálogo comercial, mesma natureza de carteira: gestor inativa.
  // `crm_loss_reasons` é governada por este módulo (§3).
  produtos: {
    read: ALL_ROLES,
    write: GESTAO,
    inactivate: GESTAO,
  },
  estrutura_comercial: {
    read: ALL_ROLES,
    write: GESTAO,
    inactivate: ADMIN,
  },
  mapa: {
    read: OPERACAO,
    write: [],
    inactivate: [],
  },
  atividades: {
    read: OPERACAO_COM_AUDITORIA,
    write: CAMPO,
    inactivate: [],
  },
  usuarios: {
    read: ADMIN,
    write: ADMIN,
    inactivate: ADMIN,
  },
  configuracoes: {
    read: ['administrador', 'gestor_adm', 'auditoria'],
    write: ADMIN,
    inactivate: [],
  },
  auditoria: {
    read: ['administrador', 'gestor_adm', 'auditoria'],
    write: [],
    inactivate: [],
  },
}

function allows(
  role: AppRole,
  module: ModuleKey,
  capability: Capability,
): boolean {
  return MODULE_CAPABILITIES[module][capability].includes(role)
}

/** Perfil pode LER (abrir/listar) o módulo. Coluna L da §3. */
export function canRead(role: AppRole, module: ModuleKey): boolean {
  return allows(role, module, 'read')
}

/** Perfil pode CRIAR/EDITAR no módulo. Colunas C/E da §3. */
export function canWrite(role: AppRole, module: ModuleKey): boolean {
  return allows(role, module, 'write')
}

/** Perfil pode INATIVAR no módulo. Coluna X da §3. */
export function canInactivate(role: AppRole, module: ModuleKey): boolean {
  return allows(role, module, 'inactivate')
}

/** Todos os módulos declarados. Fonte para os testes de completude. */
export const ALL_MODULES = Object.keys(MODULE_CAPABILITIES) as ModuleKey[]
