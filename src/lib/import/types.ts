import type { createClient } from '@/lib/supabase/server'

/** Cliente Supabase de servidor, tipado. */
export type Sb = ReturnType<typeof createClient>

export type RowError = { field?: string; message: string }
export type RowStatus = 'criar' | 'atualizar' | 'erro'

/** Uma linha do arquivo, já classificada, para a prévia. `cells` é o texto COMO
 * SERÁ GRAVADO (para conferir encoding/acentos antes de confirmar). */
export type RowResult = {
  line: number
  cells: string[]
  status: RowStatus
  errors: RowError[]
}

export type PreviewSummary = {
  total: number
  criar: number
  atualizar: number
  erro: number
}

/** Aviso agregado da prévia (ex.: "Produtos que serão criados" + a lista). */
export type Notice = { title: string; items: string[] }

/** Resultado da prévia (dry-run). `errors`/`sample` podem vir truncados para não
 * travar o navegador em arquivos grandes; os contadores em `summary` são cheios. */
export type PreviewResult = {
  ok: boolean
  headerError?: string
  columns: string[]
  summary: PreviewSummary
  notices: Notice[]
  errors: RowResult[]
  sample: RowResult[]
  errorsTruncated: boolean
  sampleTruncated: boolean
}

export type CommitResult = {
  ok: boolean
  error?: string
  criadas: number
  atualizadas: number
  ignoradas: number
}

export type ValidatedRow<T> = { value: T } | { errors: RowError[] }
export type ResolveOutcome<T> = { value: T } | { errors: RowError[] }

export type ResolveResult<TFinal> = {
  outcomes: Map<number, ResolveOutcome<TFinal>>
  notices: Notice[]
}

/**
 * O que varia por entidade. O motor (engine.ts) cuida do resto: parse, prévia,
 * classificação criar×atualizar, dedup no arquivo, chunking do commit.
 *
 * `TRaw` é o que sai da validação pura da linha; `TFinal` é o registro pronto
 * para deduplicar/gravar, produzido por `resolve` (que faz as buscas em lote —
 * casar CNPJ→empresa, Produto→produto). Entidades simples usam TRaw = TFinal e
 * um `resolve` identidade.
 */
export interface ImportSpec<TRaw, TFinal = TRaw> {
  entity: string
  requiredHeaders: string[]
  columnLabels: string[]
  template: { headers: string; example: string; filename: string }
  /** Validação/transform pura de uma linha crua. */
  validateRow(raw: Record<string, string>, line: number): ValidatedRow<TRaw>
  /** Células exibidas na prévia — o texto como será gravado. */
  displayCells(raw: Record<string, string>): string[]
  /**
   * Resolve referências em lote (empresa, produto). `write=false` na prévia (só
   * casa, nada cria); `write=true` no commit (cria o que falta e devolve ids).
   * Produz um resultado por linha (valor final ou erros) e avisos agregados.
   */
  resolve(
    sb: Sb,
    items: { line: number; value: TRaw }[],
    opts: { write: boolean },
  ): Promise<ResolveResult<TFinal>>
  /** Chave de deduplicação do registro final. null = sem chave (sempre erro). */
  keyOf(value: TFinal): string | null
  /** Carrega chave -> id dos registros existentes. */
  loadExisting(sb: Sb, keys: string[]): Promise<Map<string, string>>
  /** Insere um lote de novos (o motor já fatia em chunks). */
  insertChunk(sb: Sb, values: TFinal[]): Promise<void>
  /** Atualiza um lote de existentes por id (o motor já fatia em chunks). */
  updateChunk(sb: Sb, items: { id: string; value: TFinal }[]): Promise<void>
}
