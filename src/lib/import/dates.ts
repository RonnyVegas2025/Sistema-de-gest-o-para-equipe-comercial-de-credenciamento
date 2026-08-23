/**
 * Conversão de data brasileira para ISO, para a importação.
 *
 * Extraída de `empresas.ts` do sistema de origem — spec do domínio de
 * Agregados. A função é genérica; a spec não.
 *
 * Valida o calendário de verdade, incluindo ano bissexto: 29/02/2024 passa,
 * 29/02/2025 não. Sem isso, uma data impossível chegaria ao banco como texto
 * bem-formado e só quebraria no `insert`, longe da linha que a originou.
 */
export function brDateToIso(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null

  const dd = m[1] as string
  const mm = m[2] as string
  const yyyy = m[3] as string
  const day = Number(dd)
  const mon = Number(mm)
  const year = Number(yyyy)

  if (mon < 1 || mon > 12 || day < 1 || year < 2000) return null

  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const daysInMonth = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  if (day > (daysInMonth[mon - 1] as number)) return null

  return `${yyyy}-${mm}-${dd}`
}
