'use client'

import { SidebarBrand } from '@/components/brand'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/cn'
import { SidebarNav } from './sidebar-nav'

/**
 * Menu lateral do desktop. Expandido: 236px, agrupado. Recolhido: 60px, só o
 * símbolo, com tooltip por title no hover/foco. O drawer mobile é o MobileNav.
 */
export function Sidebar({
  items,
  collapsed,
  onToggleCollapse,
}: {
  items: NavItem[]
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-line bg-surface lg:flex lg:flex-col',
        collapsed ? 'w-[60px]' : 'w-[236px]',
      )}
    >
      <div className="flex h-14 items-center border-b border-line px-2">
        {/* Logo centralizado no espaço disponível; o botão fica à direita, fora
            do container centralizado — sem o vão do justify-between. */}
        <div className="flex flex-1 justify-center">
          <SidebarBrand collapsed={collapsed} />
        </div>
        {collapsed ? null : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Recolher menu"
            className="rounded-sm border border-line px-1.5 py-0.5 text-ink-secondary hover:bg-surface-muted"
          >
            «
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav items={items} collapsed={collapsed} />
      </div>

      {collapsed ? (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expandir menu"
            className="w-full rounded-sm border border-line px-1.5 py-1 text-ink-secondary hover:bg-surface-muted"
          >
            »
          </button>
        </div>
      ) : null}
    </aside>
  )
}
