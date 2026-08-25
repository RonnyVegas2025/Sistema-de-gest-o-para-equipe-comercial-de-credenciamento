import { normalizarCnpj } from './normalizar'
import type { CnpjProvider, CnpjLookupResult } from './types'

/**
 * Preenchimento manual — o fallback de D-008.
 *
 * *"A ausência do serviço não pode bloquear cadastro em campo."* Este provider é
 * o que garante isso enquanto A-001 não escolhe fornecedor: o formulário abre,
 * o usuário digita, o cadastro entra.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEVOLVE `nao_encontrado`, NUNCA UMA ESTRUTURA VAZIA.
 *
 * A tentação seria devolver `encontrado` com campos em branco, para o formulário
 * "só preencher". Isso gravaria `cnpj_lookup_source = 'manual'` e
 * `cnpj_lookup_at = agora` — registrando uma consulta que **nunca aconteceu**.
 *
 * Essas duas colunas existem para rastrear a ORIGEM do dado (D-008). Se elas
 * mentem, não servem para nada — e mentem de um jeito difícil de detectar
 * depois, porque o registro parece legítimo: tem fonte, tem data, tem formato
 * certo. Ninguém desconfia de um campo preenchido.
 *
 * Com `nao_encontrado`, a verdade fica registrada por omissão: nenhum
 * fornecedor respondeu, o usuário digitou, e as duas colunas ficam nulas.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const providerManual: CnpjProvider = {
  nome: 'manual',

  async lookup(cnpj: string): Promise<CnpjLookupResult> {
    const canonico = normalizarCnpj(cnpj)
    if (!canonico) {
      return {
        situacao: 'formato_invalido',
        motivo: 'CNPJ deve ter 14 dígitos.',
      }
    }
    // Validar o formato antes de "não encontrar" não é rigor vazio: sem isso, um
    // CNPJ digitado errado voltaria como não encontrado, e o usuário procuraria
    // o estabelecimento em vez de conferir o que digitou.
    return { situacao: 'nao_encontrado', cnpj: canonico }
  },
}
