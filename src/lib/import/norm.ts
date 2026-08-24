/**
 * Normalização de texto para comparação.
 *
 * Extraída de `product-key.ts` do sistema de origem, onde convive com
 * `nonComboKey`/`comboKey` — chaves de produto do domínio de Agregados, que o
 * CRM não tem. Copiar o arquivo traria domínio junto com a função; mesmo
 * critério da etapa 2.
 *
 * Ignora acento, caixa e espaço duplicado. **Preserva pontuação e parênteses**
 * de propósito: "Outros (Ronny)" e "Outros (Danilo)" são equipes distintas, e
 * apagar os parênteses as fundiria.
 *
 * ATENÇÃO AO USO NO CRM: `norm()` serve para COMPARAR TEXTO EXIBIDO — detectar
 * homônimos, avisar sobre grafias divergentes. **Não é chave de deduplicação.**
 * A chave é `source_ref` (D-004). Nome é rótulo; deduplicar por nome
 * normalizado é o que a spec da origem faz, e é o que esta importação não faz.
 */

const COMBINING = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g',
)

export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
