'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { ProfileRow } from '@/types/database'
import { navigationFor } from '@/config/navigation'
import { persistSidebarCollapsed } from '@/lib/layout/actions'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'
import { Topbar } from './topbar'

/**
 * Orquestra o estado do shell no cliente: recolhimento do menu (com persistência
 * em cookie via Server Action) e abertura do drawer mobile. Recebe o conteúdo
 * já renderizado no servidor.
 *
 * O menu é filtrado por perfil aqui (cliente), porque os itens carregam
 * componentes de ícone que não podem cruzar a fronteira RSC como props.
 */
export function ShellChrome({
  profile,
  initialCollapsed,
  children,
}: {
  profile: ProfileRow
  initialCollapsed: boolean
  children: ReactNode
}) {
  const items = useMemo(() => navigationFor(profile.role), [profile.role])
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    // Persiste sem bloquear a UI; a próxima carga lê do cookie no servidor.
    void persistSidebarCollapsed(next)
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        items={items}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <MobileNav
        items={items}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          items={items}
          profile={profile}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}
