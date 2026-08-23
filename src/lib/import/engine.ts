import { parseCsv } from './csv'
import type {
  CommitResult,
  ImportSpec,
  Notice,
  PreviewResult,
  RowError,
  RowResult,
  RowStatus,
  Sb,
} from './types'

const SAMPLE_LIMIT = 200 // linhas válidas exibidas na prévia (o resto conta, não lista)
const ERROR_LIMIT = 500 // linhas de erro exibidas na prévia
const CHUNK = 500 // linhas por chamada de escrita — segura 7 mil sem travar

type Classified<T> = {
  line: number
  cells: string[]
  status: RowStatus
  errors: RowError[]
  value?: T
  existingId?: string
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

/** Parse + validação + resolução + dedup no arquivo + classificação. */
async function classify<TRaw, TFinal>(
  spec: ImportSpec<TRaw, TFinal>,
  text: string,
  sb: Sb,
  write: boolean,
): Promise<{
  headerError?: string
  rows: Classified<TFinal>[]
  notices: Notice[]
}> {
  const parsed = parseCsv(text)
  if (!parsed.ok) return { headerError: parsed.error, rows: [], notices: [] }

  const missing = spec.requiredHeaders.filter(
    (h) => !parsed.headers.includes(h),
  )
  if (missing.length > 0) {
    return {
      headerError: `Cabeçalho faltando: ${missing.join(', ')}. Esperado: ${spec.requiredHeaders.join(';')}`,
      rows: [],
      notices: [],
    }
  }

  // 1. Validação pura, linha a linha.
  const parsedRows = parsed.rows.map((raw, idx) => {
    const line = idx + 1
    return {
      line,
      cells: spec.displayCells(raw),
      v: spec.validateRow(raw, line),
    }
  })

  // 2. Resolução em lote das linhas que passaram na validação.
  const validItems = parsedRows
    .filter((p) => 'value' in p.v)
    .map((p) => ({
      line: p.line,
      value: (p.v as { value: TRaw }).value,
    }))
  const { outcomes, notices } = await spec.resolve(sb, validItems, { write })

  const rows: Classified<TFinal>[] = parsedRows.map((p) => {
    if ('errors' in p.v) {
      return {
        line: p.line,
        cells: p.cells,
        status: 'erro',
        errors: p.v.errors,
      }
    }
    const outcome = outcomes.get(p.line)
    if (!outcome || 'errors' in outcome) {
      return {
        line: p.line,
        cells: p.cells,
        status: 'erro',
        errors:
          outcome && 'errors' in outcome
            ? outcome.errors
            : [{ message: 'Linha não resolvida.' }],
      }
    }
    return {
      line: p.line,
      cells: p.cells,
      status: 'criar',
      errors: [],
      value: outcome.value,
    }
  })

  // 3. Chave repetida no arquivo -> erro.
  const keyCount = new Map<string, number>()
  for (const r of rows) {
    if (r.status === 'erro' || r.value === undefined) continue
    const k = spec.keyOf(r.value)
    if (k) keyCount.set(k, (keyCount.get(k) ?? 0) + 1)
  }
  for (const r of rows) {
    if (r.status === 'erro' || r.value === undefined) continue
    const k = spec.keyOf(r.value)
    if (!k) {
      r.status = 'erro'
      r.errors = [{ message: 'Sem chave para deduplicar.' }]
      r.value = undefined
    } else if ((keyCount.get(k) ?? 0) > 1) {
      r.status = 'erro'
      r.errors = [{ message: 'Chave repetida no arquivo.' }]
      r.value = undefined
    }
  }

  // 4. Classifica os válidos contra os existentes.
  const keys = [
    ...new Set(
      rows
        .filter((r) => r.status !== 'erro' && r.value !== undefined)
        .map((r) => spec.keyOf(r.value as TFinal))
        .filter((k): k is string => Boolean(k)),
    ),
  ]
  const existing =
    keys.length > 0
      ? await spec.loadExisting(sb, keys)
      : new Map<string, string>()
  for (const r of rows) {
    if (r.status === 'erro' || r.value === undefined) continue
    const id = existing.get(spec.keyOf(r.value) as string)
    if (id) {
      r.status = 'atualizar'
      r.existingId = id
    } else {
      r.status = 'criar'
    }
  }

  return { rows, notices }
}

function toRowResult<T>(c: Classified<T>): RowResult {
  return { line: c.line, cells: c.cells, status: c.status, errors: c.errors }
}

export async function runPreview<TRaw, TFinal>(
  spec: ImportSpec<TRaw, TFinal>,
  text: string,
  sb: Sb,
): Promise<PreviewResult> {
  const { headerError, rows, notices } = await classify(spec, text, sb, false)
  const empty = { total: 0, criar: 0, atualizar: 0, erro: 0 }
  if (headerError) {
    return {
      ok: false,
      headerError,
      columns: spec.columnLabels,
      summary: empty,
      notices: [],
      errors: [],
      sample: [],
      errorsTruncated: false,
      sampleTruncated: false,
    }
  }

  const errorRows = rows.filter((r) => r.status === 'erro')
  const okRows = rows.filter((r) => r.status !== 'erro')
  const summary = {
    total: rows.length,
    criar: rows.filter((r) => r.status === 'criar').length,
    atualizar: rows.filter((r) => r.status === 'atualizar').length,
    erro: errorRows.length,
  }
  return {
    ok: true,
    columns: spec.columnLabels,
    summary,
    notices,
    errors: errorRows.slice(0, ERROR_LIMIT).map(toRowResult),
    sample: okRows.slice(0, SAMPLE_LIMIT).map(toRowResult),
    errorsTruncated: errorRows.length > ERROR_LIMIT,
    sampleTruncated: okRows.length > SAMPLE_LIMIT,
  }
}

export async function runCommit<TRaw, TFinal>(
  spec: ImportSpec<TRaw, TFinal>,
  text: string,
  sb: Sb,
): Promise<CommitResult> {
  const { headerError, rows } = await classify(spec, text, sb, true)
  if (headerError) {
    return {
      ok: false,
      error: headerError,
      criadas: 0,
      atualizadas: 0,
      ignoradas: 0,
    }
  }

  const creates = rows
    .filter((r) => r.status === 'criar' && r.value !== undefined)
    .map((r) => r.value as TFinal)
  const updates = rows
    .filter(
      (r) => r.status === 'atualizar' && r.value !== undefined && r.existingId,
    )
    .map((r) => ({ id: r.existingId as string, value: r.value as TFinal }))
  const ignoradas = rows.filter((r) => r.status === 'erro').length

  let criadas = 0
  let atualizadas = 0
  try {
    for (const part of chunk(creates, CHUNK)) {
      await spec.insertChunk(sb, part)
      criadas += part.length
    }
    for (const part of chunk(updates, CHUNK)) {
      await spec.updateChunk(sb, part)
      atualizadas += part.length
    }
  } catch {
    return {
      ok: false,
      error:
        'Falha ao gravar parte das linhas. Reimporte para completar — a importação é idempotente.',
      criadas,
      atualizadas,
      ignoradas,
    }
  }

  return { ok: true, criadas, atualizadas, ignoradas }
}
