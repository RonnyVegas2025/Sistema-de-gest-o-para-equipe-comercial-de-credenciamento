'use client'

import { useEffect, useRef } from 'react'
import { SidebarBrand } from '@/components/brand'
import type { NavItem } from '@/config/navigation'
import { SidebarNav } from './sidebar-nav'

const FOCUSABLE =
  'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Drawer do menu em telas pequenas. Abre pelo cabeçalho, fecha ao navegar, com
 * trap de foco e fechamento por Esc (SPRINT-0 §7).
 */
export function MobileNav({
  items,
  open,
  onClose,
}: {
  items: NavItem[]
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab' && panelRef.current) {
        const list = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        )
        if (list.length === 0) return
        const first = list[0]!
        const last = list[list.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface"
      >
        <div className="flex h-14 items-center border-b border-line px-2">
          {/* Mesmo padrão da sidebar: logo centralizado no espaço disponível,
              botão de fechar à direita, fora do container centralizado. */}
          <div className="flex flex-1 justify-center">
            <SidebarBrand />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-sm border border-line px-2 py-0.5 text-ink-secondary hover:bg-surface-muted"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav items={items} onNavigate={onClose} />
        </div>
      </div>
    </div>
  )
}
