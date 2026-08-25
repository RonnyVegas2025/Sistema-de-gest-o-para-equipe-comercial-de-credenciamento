/**
 * Normalização de CNPJ — o par da constraint de D-039.
 *
 * A aplicação normaliza ANTES de escrever; o banco recusa o que passar torto.
 * As duas metades são necessárias: sem a constraint, um chamador que esquecesse
 * de normalizar gravaria um duplicado silencioso; sem esta função, todo chamador
 * reimplementaria a limpeza e alguém erraria.
 *
 * **Não valida dígito verificador**, e isso é decisão registrada (D-039):
 * formato canônico é sobre COMPARABILIDADE — que o índice único enxergue
 * igualdade —, não sobre o CNPJ existir. Quem assumir que este módulo valida DV
 * vai deixar de validar em outro lugar.
 */

const CANONICO = /^[0-9]{14}$/

/** 14 dígitos, ou `null` se não der. Aceita pontuação e espaços na entrada. */
export function normalizarCnpj(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, '')
  return CANONICO.test(digitos) ? digitos : null
}

/** Já está canônico? Espelha exatamente o CHECK do banco. */
export function ehCnpjCanonico(valor: string): boolean {
  return CANONICO.test(valor)
}

/** Apresentação: 00.000.000/0000-00. Nunca gravado — só exibido. */
export function formatarCnpj(canonico: string): string {
  if (!ehCnpjCanonico(canonico)) return canonico
  return canonico.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  )
}
