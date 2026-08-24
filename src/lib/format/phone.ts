/** Telefones: celular (11 dígitos) e fixo (10). Grava só dígitos, formata na
 * exibição — mesmo padrão do CNPJ. */

export type PhoneKind = 'celular' | 'fixo'

const MAX_DIGITS: Record<PhoneKind, number> = { celular: 11, fixo: 10 }

/** Mantém só dígitos, no máximo o tamanho do tipo. */
export function phoneDigits(value: string, kind: PhoneKind): string {
  return value.replace(/\D/g, '').slice(0, MAX_DIGITS[kind])
}

/**
 * Máscara progressiva: celular "(00) 00000-0000", fixo "(00) 0000-0000".
 * Com menos dígitos, devolve o parcial (uso na digitação).
 */
export function formatPhone(value: string, kind: PhoneKind): string {
  const d = phoneDigits(value, kind)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (kind === 'celular') {
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
}

/** Válido quando tem exatamente a quantidade de dígitos do tipo (11 ou 10). */
export function isValidPhone(value: string, kind: PhoneKind): boolean {
  return value.replace(/\D/g, '').length === MAX_DIGITS[kind]
}
