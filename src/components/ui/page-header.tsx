import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Breadcrumb, type Crumb } from './breadcrumb'

export type PageHeaderProps = {
  title: string
  breadcrumb?: Crumb[]
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Cabeçalho de página: trilha, título e ações. Usado pelo shell (etapa 6). */
export function PageHeader({
  title,
  breadcrumb,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-ink-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
