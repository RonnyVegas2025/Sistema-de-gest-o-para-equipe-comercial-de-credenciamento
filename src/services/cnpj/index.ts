import { providerManual } from './manual'
import type { CnpjProvider } from './types'

export type { CnpjProvider, CnpjLookupResult, CnpjDados } from './types'
export { normalizarCnpj, ehCnpjCanonico, formatarCnpj } from './normalizar'
export { providerManual } from './manual'

/**
 * O ÚNICO ponto que sabe qual fornecedor existe.
 *
 * Nenhum chamador importa `manual` diretamente; todos pedem `cnpjProvider()`.
 * É o que torna verdadeira a afirmação de D-008 — trocar de fornecedor é trocar
 * de implementação, não de chamador —, e o teste `trocar a implementação não
 * toca em nenhum chamador` é o que a mantém verdadeira.
 *
 * Quando A-001 escolher o fornecedor real, a mudança é aqui: uma condição sobre
 * configuração, com `providerManual` seguindo como fallback quando a consulta
 * estiver desligada ou sem credencial.
 */
export function cnpjProvider(): CnpjProvider {
  return providerManual
}
