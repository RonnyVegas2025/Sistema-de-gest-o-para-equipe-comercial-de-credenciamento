'use client'

import { useEffect, useRef, useState } from 'react'
import { logout } from '@/lib/auth/actions'
import { roleLabel } from '@/lib/permissions/roles'
import type { ProfileRow } from '@/types/database'
import { cn } from '@/lib/cn'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]![0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function UserMenu({ profile }: { profile: ProfileRow }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-muted"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600"
        >
          {initials(profile.full_name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm text-ink">{profile.full_name}</span>
          <span className="block text-xs text-muted">
            {roleLabel(profile.role)}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-30 mt-2 w-56 rounded-lg border border-line bg-surface p-2 shadow-overlay',
          )}
        >
          <div className="border-b border-line px-2 pb-2">
            <p className="text-sm font-medium text-ink">{profile.full_name}</p>
            <p className="truncate text-xs text-muted">{profile.email}</p>
            <p className="mt-1 text-xs text-brand-600">
              {roleLabel(profile.role)}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="mt-1 w-full rounded px-2 py-2 text-left text-sm text-ink hover:bg-surface-muted"
            >
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
