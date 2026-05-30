// Sprint CSV Import (30/05/2026) — Adapter CSV → ParseXlsxResult-like.
//
// O fluxo de Excel (parseXlsx → heuristicFallback → stagedData) já é
// robusto. Pra CSV GENÉRICO (header desconhecido) reusamos esse fluxo
// inteiro retornando shape compatível com `ParseXlsxResult`.
//
// CACULA NÃO usa este adapter — usa `mapearCacula` direto via fast-path.

import { createHash } from 'node:crypto'
import { parseCsv, type ParsedCsv } from './parse-csv'
import type { ParseXlsxResult, ParsedRow } from '@/lib/excel-import/parse-xlsx'

export interface ParseCsvAsXlsxResult extends ParseXlsxResult {
  /** Mantém parsed CSV original pra debug/audit */
  raw: ParsedCsv
}

export function parseCsvAsXlsx(text: string): ParseCsvAsXlsxResult {
  const parsed = parseCsv(text)

  // ParsedRow.cells é Record<header, value>. Como headers podem
  // repetir (raro mas possível em CSV genérico), preservamos o
  // primeiro valor e ignoramos duplicados — comportamento idêntico
  // ao parseXlsx que usa Map por header.
  const headers = parsed.headers
  const rows: ParsedRow[] = parsed.rows.map((row, i) => {
    const cells: Record<string, string | number | null> = {}
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (key in cells) continue // primeiro valor ganha
      const v = row[c] ?? null
      cells[key] = v === '' || v === '-' ? null : v
    }
    return {
      rowIndex: i + 2, // base-2 (linha 1 = header), igual ao parseXlsx
      cells,
    }
  })

  // headerHash idêntico ao usado em parseXlsx pra reaproveitar cache
  // de detection IA.
  const headerHash = createHash('sha256')
    .update(headers.join('|'))
    .digest('hex')

  return {
    headers,
    headerHash,
    rows,
    filteredCount: parsed.linhasIgnoradas,
    sheetName: 'CSV',
    totalSheets: 1,
    raw: parsed,
  }
}
