import { cn } from '@/lib/cn'
import { Button } from './button'

export type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

/** Paginação simples: anterior/próxima e a posição atual. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: PaginationProps) {
  const canPrev = page > 1
  const canNext = page < pageCount

  return (
    <nav
      className={cn('flex items-center justify-between gap-4', className)}
      aria-label="Paginação"
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
      >
        Anterior
      </Button>
      <span className="vg-numeric text-sm text-muted" aria-live="polite">
        {page} de {Math.max(pageCount, 1)}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
      >
        Próxima
      </Button>
    </nav>
  )
}
