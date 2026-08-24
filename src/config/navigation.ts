import type { LucideIcon } from 'lucide-react'
import { Home, Users } from 'lucide-react'
import type { AppRole } from '@/types/database'
import { canRead, type ModuleKey } from '@/lib/permissions/can'

export type NavGroup = 'Operação' | 'Cadastros' | 'Administração'

/** Ordem dos grupos no menu. Fonte única para render e testes. */
export const GROUP_ORDER: readonly NavGroup[] = [
  'Operação',
  'Cadastros',
  'Administração',
]

export type NavItem = {
  label: string
  href: string
  group: NavGroup
  module: ModuleKey
  /** Ícone lucide-react, definido aqui e nunca escolhido no componente. */
  icon: LucideIcon
}

/**
 * Definição única do menu. Menu, breadcrumb e verificação de rota leem daqui.
 *
 * **Item só existe quando a página está funcional.** Carteira, oportunidades,
 * agenda, visitas, estabelecimentos e os demais entram como parte da entrega da
 * sprint que os torna funcionais — nunca antes, e nunca desabilitados. Item
 * morto no menu ensina o usuário a ignorar o menu.
 *
 * `Usuários` entrou junto com a página, na etapa 1 da Sprint 2, e não antes.
 */
export const NAVIGATION: readonly NavItem[] = [
  {
    label: 'Início',
    href: '/inicio',
    group: 'Operação',
    module: 'inicio',
    icon: Home,
  },
  {
    label: 'Usuários',
    href: '/usuarios',
    group: 'Administração',
    module: 'usuarios',
    icon: Users,
  },
]

/** Itens visíveis para um papel. O menu é conveniência; a RLS é a fronteira. */
export function navigationFor(role: AppRole): NavItem[] {
  return NAVIGATION.filter((item) => canRead(role, item.module))
}

/**
 * Agrupa os itens na ordem canônica dos grupos, descartando grupo vazio — um
 * cabeçalho de grupo sem item abaixo é ruído.
 */
export function groupNavigation(
  items: NavItem[],
): { group: NavGroup; items: NavItem[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length > 0)
}

/** Item cuja rota casa com o pathname atual, para marcar o ativo. */
export function activeItem(pathname: string): NavItem | undefined {
  return NAVIGATION.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
}
