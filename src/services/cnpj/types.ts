/**
 * Contrato da consulta de CNPJ (D-008).
 *
 * O fornecedor real não foi escolhido (A-001). O que existe aqui é o contrato e
 * o ponto de integração: trocar de fornecedor é trocar de implementação, não de
 * chamador.
 */

/** Dados públicos normalizados para o modelo interno — colunas de `companies`. */
export type CnpjDados = {
  cnpj: string
  legal_name: string
  trade_name: string | null
  situacao_cadastral: string | null
  cnae_principal: string | null
  atividade: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  telefone: string | null
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * UNIÃO DISCRIMINADA, E NÃO `CnpjDados | null`.
 *
 * `null` colapsaria "não encontrado" e "fornecedor fora do ar" **no tipo**, e
 * nenhuma disciplina de chamador recupera informação que o tipo jogou fora. As
 * duas situações pedem telas diferentes: uma manda preencher à mão, a outra
 * manda tentar de novo.
 *
 * Com a união, a tela que esquecer um caso não compila.
 * ────────────────────────────────────────────────────────────────────────────
 */
export type CnpjLookupResult =
  | {
      situacao: 'encontrado'
      dados: CnpjDados
      /** Vai para `companies.cnpj_lookup_source` — qual fornecedor respondeu. */
      fonte: string
      /** Vai para `companies.cnpj_lookup_at`. */
      consultadoEm: string
    }
  | { situacao: 'nao_encontrado'; cnpj: string }
  | { situacao: 'formato_invalido'; motivo: string }
  | { situacao: 'indisponivel'; fornecedor: string; detalhe?: string }

/**
 * `lookup` **não lança**.
 *
 * Timeout, indisponibilidade e limite de chamadas são estados previstos por
 * D-008, não excepcionais. Exceção obrigaria todo chamador a um `try/catch` que
 * alguém vai esquecer — e o esquecimento vira tela branca no tablet, em campo,
 * longe de quem poderia consertar.
 *
 * `throw` fica reservado a erro de programação.
 */
export type CnpjProvider = {
  /** Identifica quem respondeu. Gravado como `cnpj_lookup_source`. */
  readonly nome: string
  lookup(cnpj: string): Promise<CnpjLookupResult>
}
