// Sprint 5.0.2.0 — Parser de planilhas XLSX/XLS pra Contas a Pagar.
//
// Estratégia:
//   1. Carrega só a PRIMEIRA aba (caso aba múltipla, IA detectará e
//      retornará erro pra user escolher — fora desta sprint).
//   2. Header = linha 1; demais = dados.
//   3. Boundary: arredonda Valor pra 2 casas decimais (corrige floating
//      point sujo do Excel tipo 300.47000000000003).
//   4. Filtra linhas SEM Favorecido (subtotais, totais, separadores) e
//      linhas com keyword "TOTAL" / "SUBTOTAL" no Favorecido.
//   5. Datas: aceita string DD/MM/YYYY OU Date nativo (Excel serializa
//      como Date dependendo da célula).
//
// Saída intencionalmente "crua" — IA detect-columns mapeia os headers
// pra campos canônicos depois.

import ExcelJS from 'exceljs'
import { createHash } from 'node:crypto'

export interface ParsedRow {
  rowIndex: number // base-2 (linha do Excel; row 1 = header)
  /** Header → valor da célula. */
  cells: Record<string, string | number | null>
}

export interface ParseXlsxResult {
  headers: string[]
  /** Hash sha256 dos headers em ordem (cache de detection cross-import). */
  headerHash: string
  rows: ParsedRow[]
  /** Linhas que foram FILTRADAS (subtotais, linhas vazias) — só pra audit/log. */
  filteredCount: number
  sheetName: string
  totalSheets: number
}

const TOTAL_KEYWORDS = ['TOTAL', 'SUBTOTAL', 'SOMA', 'TOTAIS']

function looksLikeTotalRow(value: string | number | null): boolean {
  if (value === null || value === undefined) return true
  const s = String(value).toUpperCase().trim()
  if (s === '') return true
  return TOTAL_KEYWORDS.some((k) => s.startsWith(k) || s === k)
}

function normalizeHeader(s: string | null | undefined): string {
  return String(s ?? '').trim()
}

function cellValue(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    // Sprint 5.0.2.0 — arredonda 2 casas pra evitar 300.47000000000003
    return Math.round(v * 100) / 100
  }
  if (v instanceof Date) {
    // Devolve DD/MM/YYYY (boundary do parser; consumidor converte se quiser Date)
    const d = v.getUTCDate().toString().padStart(2, '0')
    const m = (v.getUTCMonth() + 1).toString().padStart(2, '0')
    const y = v.getUTCFullYear()
    return `${d}/${m}/${y}`
  }
  if (typeof v === 'object') {
    // ExcelJS retorna objetos pra fórmulas, hyperlinks, etc.
    const obj = v as { result?: unknown; text?: unknown }
    if (obj.result !== undefined) return cellValue({ value: obj.result } as ExcelJS.Cell)
    if (obj.text !== undefined) return String(obj.text).trim()
  }
  return String(v).trim()
}

/**
 * Parseia .xlsx/.xls. Lê apenas a primeira aba.
 *
 * Limitações conhecidas:
 *   - Aba múltipla: retorna apenas a primeira (totalSheets exposto)
 *   - Header sempre linha 1 (caso planilhas ASSECONT/Excel comuns)
 *   - Filtra subtotais por keyword (TOTAL/SUBTOTAL/SOMA)
 */
export async function parseXlsx(
  buffer: ArrayBuffer | Buffer,
): Promise<ParseXlsxResult> {
  const workbook = new ExcelJS.Workbook()
  const ab =
    buffer instanceof ArrayBuffer
      ? buffer
      : (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
  await workbook.xlsx.load(ab)

  const totalSheets = workbook.worksheets.length
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new Error('Planilha sem abas.')
  }

  const sheetName = sheet.name

  // Detecta linha do header — assume linha 1, mas se for vazia pula até achar
  let headerRowIdx = 1
  while (headerRowIdx <= sheet.rowCount) {
    const row = sheet.getRow(headerRowIdx)
    const filled = row.values
      ? (row.values as unknown[]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length
      : 0
    if (filled >= 2) break // header tem que ter ≥2 colunas (caso mínimo)
    headerRowIdx++
  }
  if (headerRowIdx > sheet.rowCount) {
    return {
      headers: [],
      headerHash: '',
      rows: [],
      filteredCount: 0,
      sheetName,
      totalSheets,
    }
  }

  // Headers (colunas A, B, C, ...)
  const headerRow = sheet.getRow(headerRowIdx)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const h = normalizeHeader(String(cell.value ?? ''))
    if (h) headers.push(h)
  })

  const headerHash = createHash('sha256').update(headers.join('|')).digest('hex')

  // Dados — pula até linha header+1
  const rows: ParsedRow[] = []
  let filteredCount = 0

  for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    if (!row || row.cellCount === 0) {
      filteredCount++
      continue
    }

    const cells: Record<string, string | number | null> = {}
    let hasAnyValue = false
    headers.forEach((h, idx) => {
      // ExcelJS é 1-indexed; idx do header começa em 0 → coluna idx+1
      const cell = row.getCell(idx + 1)
      const value = cellValue(cell)
      cells[h] = value
      if (value !== null && String(value).trim() !== '') hasAnyValue = true
    })

    if (!hasAnyValue) {
      filteredCount++
      continue
    }

    // Filtra linhas-total (primeira coluna com "TOTAL" / vazia em "favorecido-like")
    const firstColVal = cells[headers[0]]
    if (looksLikeTotalRow(firstColVal)) {
      filteredCount++
      continue
    }

    rows.push({ rowIndex: r, cells })
  }

  return { headers, headerHash, rows, filteredCount, sheetName, totalSheets }
}

/**
 * Converte string BR "DD/MM/YYYY" pra Date UTC. Aceita também "MM/YYYY"
 * (competência) que vira primeiro dia do mês.
 */
export function parseBRDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const trimmed = String(s).trim()
  if (!trimmed) return null
  // DD/MM/YYYY
  const m1 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m1) {
    const [, d, mo, y] = m1
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
    return new Date(Date.UTC(year, parseInt(mo, 10) - 1, parseInt(d, 10)))
  }
  // MM/YYYY (competência)
  const m2 = trimmed.match(/^(\d{1,2})\/(\d{4})$/)
  if (m2) {
    const [, mo, y] = m2
    return new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, 1))
  }
  // ISO ou Date nativo já formatado
  const tryParse = new Date(trimmed)
  if (!isNaN(tryParse.getTime())) return tryParse
  return null
}
