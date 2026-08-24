/**
 * Parser de CSV puro (sem banco), testável. Trata:
 *  - BOM UTF-8 no início (removido) — o arquivo do dono é UTF-8 com BOM;
 *  - campos entre aspas com o separador ou quebra de linha dentro;
 *  - aspas escapadas como "";
 *  - \r\n e \n; linhas totalmente vazias são ignoradas.
 *
 * A leitura do arquivo no cliente usa File.text(), que decodifica UTF-8 — então
 * "São Camilo" chega íntegro aqui, e a prévia mostra o texto como será gravado.
 */

export type CsvParseResult =
  | { ok: true; headers: string[]; rows: Record<string, string>[] }
  | { ok: false; error: string }

/** Divide o texto inteiro em linhas de células, respeitando aspas. */
function scanRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let hadContent = false

  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i)
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      hadContent = true
      continue
    }
    if (c === delimiter) {
      row.push(field)
      field = ''
      hadContent = true
      continue
    }
    if (c === '\r') continue
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      hadContent = false
      continue
    }
    field += c
    hadContent = true
  }
  if (hadContent || field !== '') {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Grid cru do CSV (para o fluxo que localiza o cabeçalho em qualquer posição —
 * ver import/grid.ts). Mantém TODAS as linhas, incluindo as acima do cabeçalho. */
export function csvToGrid(text: string, delimiter = ';'): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  return scanRows(clean, delimiter)
}

export function parseCsv(text: string, delimiter = ';'): CsvParseResult {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const raw = scanRows(clean, delimiter)
  if (raw.length === 0) return { ok: false, error: 'Arquivo vazio.' }

  const headers = (raw[0] ?? []).map((h) => h.trim())
  if (headers.length === 0 || headers.every((h) => h === '')) {
    return { ok: false, error: 'Cabeçalho ausente ou vazio.' }
  }

  const rows: Record<string, string>[] = []
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] ?? []
    if (cells.every((c) => c.trim() === '')) continue
    const record: Record<string, string> = {}
    headers.forEach((h, idx) => {
      record[h] = (cells[idx] ?? '').trim()
    })
    rows.push(record)
  }
  return { ok: true, headers, rows }
}
