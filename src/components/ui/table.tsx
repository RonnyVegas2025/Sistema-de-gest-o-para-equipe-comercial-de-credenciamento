import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table
        className={cn('w-full border-collapse text-sm', className)}
        {...props}
      />
    </div>
  )
}

export function THead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-surface-muted text-ink-secondary', className)}
      {...props}
    />
  )
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function TR({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b border-line last:border-0', className)}
      {...props}
    />
  )
}

export type THProps = ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean
}

export function TH({ numeric, className, ...props }: THProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide lg:py-2',
        numeric && 'whitespace-nowrap text-right',
        className,
      )}
      {...props}
    />
  )
}

export type TDProps = TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean
}

export function TD({ numeric, className, ...props }: TDProps) {
  return (
    <td
      className={cn(
        'px-3 py-3 text-ink lg:py-2',
        numeric && 'vg-numeric whitespace-nowrap text-right',
        className,
      )}
      {...props}
    />
  )
}
