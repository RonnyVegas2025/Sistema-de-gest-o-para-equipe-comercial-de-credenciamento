'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/config/navigation'
import type { ProfileRow } from '@/types/database'
import { UserMenu } from './user-menu'

function currentTitle(items: NavItem[], pathname: string): string {
  const match = items.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
  return match?.label ?? ''
}

/**
 * Cabeçalho: botão do menu (mobile), título da página atual, busca sem função
 * nesta sprint (visível, com aviso — SPRINT-0 §6), notificações sem contador
 * falso, e o menu do perfil.
 */
export function Topbar({
  items,
  profile,
  onOpenMenu,
}: {
  items: NavItem[]
  profile: ProfileRow
  onOpenMenu: () => void
}) {
  const pathname = usePathname()
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        className="rounded-sm border border-line px-2 py-1 text-ink-secondary hover:bg-surface-muted lg:hidden"
      >
        ☰
      </button>

      <h1 className="font-display text-base text-ink">
        {currentTitle(items, pathname)}
      </h1>

      <div className="relative ml-auto hidden md:block">
        <input
          type="text"
          readOnly
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar por CNPJ, empresa ou contrato"
          aria-describedby="busca-aviso"
          className="h-9 w-64 rounded border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-placeholder"
        />
        <span id="busca-aviso" className="vg-sr-only">
          Busca disponível a partir da próxima sprint
        </span>
        {searchFocused ? (
          <div className="absolute left-0 right-0 top-full mt-1 rounded border border-line bg-surface px-3 py-2 text-xs text-muted shadow-raised">
            Busca disponível a partir da próxima sprint.
          </div>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Notificações"
        className="ml-auto rounded-full p-2 text-ink-secondary hover:bg-surface-muted md:ml-0"
      >
        <span aria-hidden>🔔</span>
      </button>

      <UserMenu profile={profile} />
    </header>
  )
}
