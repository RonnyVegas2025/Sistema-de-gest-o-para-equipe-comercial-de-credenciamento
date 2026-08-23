/**
 * Camada de GRID compartilhada entre CSV e XLSX (Sprint 2, Etapa 5b). Um arquivo
 * de qualquer formato vira `string[][]`; daqui pra frente o tratamento é o mesmo.
 *
 * Planilhas reais não têm cabeçalho em A1: a de fechamento tem os totais na linha
 * 1 e os dados a partir da coluna B. Então NÃO assumimos posição — procuramos a
 * primeira linha que contém todas as colunas obrigatórias (por nome normalizado,
 * tolerante a acento/caixa/espaço/pontuação) e ignoramos colunas vazias à esquerda.
 */

const COMBINING = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g',
)

export type Grid = string[][]

/** Normaliza um nome de coluna: sem acento, minúsculo, pontuação/underscore/espaço
 * viram um espaço só. "Qtde_Titulares" e "QTDE  TITULARES" -> "qtde titulares". */
export function normHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type LocatedHeader = {
  /** Índice (0-based) da linha de cabeçalho no grid. */
  headerRow: number
  /** Nomes de coluna normalizados presentes na linha de cabeçalho. */
  headers: string[]
  /** Coluna absoluta da primeira coluna cujo nome casa com algum dos aliases. */
  colOf(aliases: string[]): number | null
}

export type LocateResult =
  { ok: true; located: LocatedHeader } | { ok: false; error: string }

/**
 * Acha a linha de cabeçalho: a primeira em que CADA grupo obrigatório tem ao
 * menos um alias presente. `requiredGroups` é uma lista de grupos; cada grupo é
 * a lista de nomes aceitáveis (já normalizados) para uma coluna obrigatória.
 */
export function locateHeader(
  grid: Grid,
  requiredGroups: string[][],
): LocateResult {
  for (let r = 0; r < grid.length; r++) {
    const cells = grid[r] ?? []
    const norm = cells.map(normHeader)
    const present = new Set(norm.filter((n) => n !== ''))
    const allGroups = requiredGroups.every((group) =>
      group.some((alias) => present.has(alias)),
    )
    if (!allGroups) continue

    const located: LocatedHeader = {
      headerRow: r,
      headers: norm.filter((n) => n !== ''),
      colOf(aliases) {
        for (let c = 0; c < norm.length; c++) {
          if (norm[c] && aliases.includes(norm[c]!)) return c
        }
        return null
      },
    }
    return { ok: true, located }
  }
  return {
    ok: false,
    error:
      'Não encontrei a linha de cabeçalho com as colunas obrigatórias (Produto, CNPJ, Qtde_Titulares, Qtde_Dependentes).',
  }
}

/** Linhas de dados (após o cabeçalho), pulando as totalmente vazias. Cada linha
 * vem com o número REAL na planilha (1-based) para a prévia apontar certo. */
export function dataRows(
  grid: Grid,
  headerRow: number,
): { rowNumber: number; cells: string[] }[] {
  const out: { rowNumber: number; cells: string[] }[] = []
  for (let r = headerRow + 1; r < grid.length; r++) {
    const cells = grid[r] ?? []
    if (cells.every((c) => c.trim() === '')) continue
    out.push({ rowNumber: r + 1, cells })
  }
  return out
}
