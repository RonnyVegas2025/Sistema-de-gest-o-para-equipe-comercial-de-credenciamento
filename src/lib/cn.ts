export type ClassValue = string | number | false | null | undefined

/**
 * Junta classes, ignorando valores falsy. Suporta o padrão
 * cn('base', condicao && 'extra'). Está entre as tailwindFunctions do
 * .prettierrc, então o Prettier ordena as classes dentro dela.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
