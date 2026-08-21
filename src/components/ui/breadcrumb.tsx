import { Fragment } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

export type Crumb = { label: string; href?: string }

export type BreadcrumbProps = {
  items: Crumb[]
  className?: string
}

/** Trilha de navegação. O último item é a página atual (aria-current). */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Trilha" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li>
                {item.href && !last ? (
                  <Link href={item.href} className="hover:text-ink">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(last && 'text-ink-secondary')}
                    aria-current={last ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {last ? null : (
                <li aria-hidden className="text-ink-placeholder">
                  /
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
