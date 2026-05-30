// Sprint Export CSV+PDF (29/05/2026) — gerador CSV genérico compartilhado.
//
// Convenção do projeto (3 libs anteriores: lib/audit-csv, lib/transacoes/csv,
// lib/contas-pagar/csv-export):
// - BOM UTF-8 no início (Excel BR reconhece acentos)
// - Separador de campo: vírgula
// - Escape RFC 4180: aspas duplas em campos com `,` `"` `\n` `\r` `;`
// - Line ending: \r\n
// - Decimais em vírgula como separador (Excel BR)
//
// NÃO confundir com `lib/audit-csv.ts` ou outras — esta lib é a base
// genérica nova pra relatórios; as libs antigas continuam funcionando
// inalteradas pra Contas a Pagar/Audit/Transações.

const BOM = '﻿'
const SEP = ','
const LF = '\r\n'

/**
 * Escapa um valor pro padrão RFC 4180.
 * - null/undefined → string vazia
 * - números → toString (sem locale, locale fica pra `formatBRLForCsv`)
 * - strings com `,` `"` `\n` `\r` `;` → envoltas em aspas + aspas escapadas
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (
    str.includes(SEP) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.includes(';')
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Monta o CSV final a partir de headers + rows (matriz). Inclui BOM.
 *
 * Rows podem conter qualquer tipo — o `escapeCsvField` cuida da
 * serialização. Pra formatação BRL/data, use os helpers em
 * `lib/export/csv/format-*.ts` antes de passar pro builder.
 */
export function buildCSV(
  headers: string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines = [
    headers.map(escapeCsvField).join(SEP),
    ...rows.map((row) => row.map(escapeCsvField).join(SEP)),
  ]
  return BOM + lines.join(LF)
}
