'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { groupNavigation, type NavItem } from '@/config/navigation'
import { cn } from '@/lib/cn'

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNav({
  items,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1 px-2">
      {groupNavigation(items).map(({ group, items: groupItems }) => {
        return (
          <div key={group}>
            {collapsed ? null : (
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-placeholder">
                {group}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {groupItems.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <li key={item.href} className="relative">
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-0 w-0.5 rounded bg-brand-ribbon-v"
                      />
                    ) : null}
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-brand-50 font-medium text-brand-700'
                          : 'text-ink-secondary hover:bg-surface-muted',
                      )}
                    >
                      <item.icon
                        aria-hidden
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-brand-500' : 'text-ink-secondary',
                        )}
                      />
                      {collapsed ? null : <span>{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
