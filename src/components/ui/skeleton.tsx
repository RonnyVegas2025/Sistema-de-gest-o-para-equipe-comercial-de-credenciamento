import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Placeholder de carregamento. A animação respeita prefers-reduced-motion
 * (regra global em tokens.css). */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded bg-surface-muted', className)}
      {...props}
    />
  )
}
