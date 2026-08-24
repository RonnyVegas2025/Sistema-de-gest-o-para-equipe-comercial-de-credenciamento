import ExcelJS from 'exceljs'
import type { Grid } from './grid'

/**
 * Adaptador XLSX -> grid `string[][]` (Sprint 2, Etapa 5b). Roda SÓ no servidor
 * (exceljs é lib Node). A planilha de fechamento é XLSX com layout sujo (totais
 * na linha 1, dados a partir da coluna B) — a localização do cabeçalho fica com
 * import/grid.ts; aqui só transformamos células em texto, preservando a posição
 * (inclusive a coluna A vazia), para o CNPJ numérico não perder dígito.
 *
 * CNPJ é o ponto sensível: no XLSX ele costuma ser NÚMERO. String(numero) devolve
 * os dígitos sem notação científica (14 dígitos < 2^53, exato). Um zero à esquerda
 * perdido volta na normalização (cobranca.ts), não aqui — este adaptador não
 * conhece CNPJ, só devolve o texto fiel da célula.
 *
 * Porcentagem: uma célula formatada como % guarda a FRAÇÃO (-0,3468 exibido como
 * "-34,68%"). Aqui devolvemos o número que o usuário VÊ (fração × 100), senão a
 * margem sairia 100× menor que a do sistema.
 */

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    // Fórmula: usa o resultado calculado.
    if ('result' in value && value.result != null) {
      return cellToString(value.result as ExcelJS.CellValue)
    }
    // Rich text: concatena os fragmentos.
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join('')
    }
    // Hyperlink/texto: usa o texto visível.
    if ('text' in value && value.text != null) return String(value.text)
    if ('error' in value) return ''
  }
  return ''
}

/** Valor numérico de uma célula (número direto ou resultado de fórmula), senão null. */
function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return value
  if (
    value &&
    typeof value === 'object' &&
    'result' in value &&
    typeof value.result === 'number'
  ) {
    return value.result
  }
  return null
}

/** Lê a primeira planilha do XLSX como grid denso de texto (posição preservada). */
export async function xlsxToGrid(buffer: ArrayBuffer): Promise<Grid> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return []

  const grid: Grid = []
  const cols = ws.columnCount
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const cells: string[] = []
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c)
      const num = cellNumber(cell.value)
      const isPercent =
        typeof cell.numFmt === 'string' && cell.numFmt.includes('%')
      const text =
        num !== null && isPercent ? String(num * 100) : cellToString(cell.value)
      cells.push(text.trim())
    }
    grid.push(cells)
  }
  return grid
}
