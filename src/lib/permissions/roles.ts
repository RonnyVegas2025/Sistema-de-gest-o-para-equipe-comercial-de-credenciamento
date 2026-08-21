import type { AppRole } from '@/types/database'

/** Ordem canônica dos perfis, do mais ao menos privilegiado. */
export const ALL_ROLES: readonly AppRole[] = [
  'administrador',
  'gestor_adm',
  'analista_adm',
  'comercial',
  'financeiro',
  'auditoria',
] as const

/**
 * Rótulo e descrição de cada perfil, conforme `RLS_PERMISSOES.md` §2.
 *
 * A nomenclatura dos seis perfis é herdada do Painel ADM (D-002), mas o
 * significado **não é copiado**: as descrições da origem falam de contratos,
 * custos e implantação, que são domínio de Agregados. Aqui elas descrevem a
 * operação de credenciamento.
 *
 * Papel diz o que a pessoa faz; hierarquia diz sobre quais dados (D-005). Não
 * existe papel `diretor`: diretor é `gestor_adm` cujo vínculo em `directors`
 * resolve para a diretoria inteira.
 */
export const ROLES: Record<AppRole, { label: string; description: string }> = {
  administrador: {
    label: 'Administrador',
    description:
      'Acesso corporativo total, inclusive usuários, parâmetros e auditoria.',
  },
  gestor_adm: {
    label: 'Gestor Comercial',
    description:
      'Gestão comercial: carteiras, distribuição, reatribuição e importações. Diretores usam este papel, com escopo maior por vínculo.',
  },
  analista_adm: {
    label: 'Analista Comercial',
    description:
      'Apoio administrativo: cadastro de estabelecimentos e contatos, sem gestão de carteira.',
  },
  comercial: {
    label: 'Consultor Comercial',
    description:
      'Carteira própria, oportunidades, atividades, visitas e agenda.',
  },
  financeiro: {
    label: 'Financeiro',
    description:
      'Praticamente fora do CRM na V1 — não há dado financeiro; taxa negociada é condição comercial, não faturamento.',
  },
  auditoria: {
    label: 'Leitura/Auditoria',
    description: 'Somente consulta e exportação.',
  },
}

/** Rótulo legível de um papel. */
export function roleLabel(role: AppRole): string {
  return ROLES[role].label
}
