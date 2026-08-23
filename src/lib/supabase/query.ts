import type { PostgrestResponse } from '@supabase/supabase-js'

/**
 * Desempacota resultados de LISTA/CONTAGEM do PostgREST **propagando erro** em
 * vez de mascarar como vazio. Falha de schema (ex.: 42P01, relação inexistente
 * — migration não aplicada) tem de estourar, não virar lista vazia
 * indistinguível de "sem dados". RLS que nega um SELECT devolve conjunto vazio
 * SEM erro, então leitura legítima sem linhas continua `[]` — não é confundida
 * com falha.
 *
 * Para linha única use `.maybeSingle()` com checagem inline `if (error) throw
 * error` no chamador — o TS não infere o tipo através de um wrapper genérico
 * sobre a união do PostgrestMaybeSingleResponse, então o desempacote fica no
 * ponto de uso, onde a inferência do supabase-js funciona.
 */

/** Lista: erro estoura; sem linhas (inclui RLS negando) vira []. */
export function rows<T>(result: PostgrestResponse<T>): T[] {
  if (result.error) throw result.error
  return result.data ?? []
}

/** Contagem (`head: true`): erro estoura; ausência vira 0. */
export function countOf<T>(result: PostgrestResponse<T>): number {
  if (result.error) throw result.error
  return result.count ?? 0
}
