// Sprint 5.0.3.0b — Geração de CSV brasileiro pra /api/.../export.
//
// CRÍTICO pra Excel BR:
//   - UTF-8 BOM (caracteres acentuados não viram "?")
//   - Separador ';' (não vírgula — vírgula é decimal)
//   - Quebras de linha CRLF (\r\n)
//   - Valores formatados como string BR (1.234,56)
//   - Datas dd/MM/yyyy
//
// Função PURA — recebe rows + retorna string. Endpoint Just envia com headers.

import { payableVisualStatus, payableStatusLabel } from '@/components/contas-pagar/payable-status'
import type { PayableRow } from '@/components/contas-pagar/PayableTable'

export interface ExportRow extends PayableRow {
  /** Categoria.dreGroup (Plano de Contas) — opcional, vem de include do Prisma. */
  category: {
    id: string
    name: string
    color: string
    dreGroup?: string | null
  } | null
  /** Para Tipo (FORNECEDOR/FUNCIONARIO/ORGAO_PUBLICO) — null se não detectado */
  favorecidoType?: string | null
}

export const BOM = '﻿'
export const SEPARATOR = ';'
export const LINE_BREAK = '\r\n'

const CSV_HEADERS = [
  'Status',
  'Vencimento',
  'Pagamento',
  'Favorecido',
  'Tipo',
  'Descrição',
  'Categoria',
  'Plano de Contas',
  'NFe',
  'Banco',
  'Forma Pagamento',
  'Valor',
  'Notas',
]

/** Escapa um valor pra CSV. Aspas duplas se contém ; ou " ou \n. */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (
    s.includes(SEPARATOR) ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Formata número BR: 1234.56 → "1.234,56" */
export function formatNumberBR(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formata data dd/MM/yyyy em UTC (consistente com input HTML date) */
export function formatDateBR(d: string | Date | null): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${day}/${month}/${year}`
}

/** Tradução PT-BR pro Tipo do favorecido. */
function favorecidoTipoLabel(t: string | null | undefined): string {
  if (!t) return ''
  switch (t) {
    case 'SUPPLIER':
      return 'Fornecedor'
    case 'EMPLOYEE':
      return 'Funcionário'
    case 'ORGAO_PUBLICO':
      return 'Órgão público'
    default:
      return t
  }
}

/** Resolve nome do favorecido (supplier OU employee). */
function favorecidoNome(row: ExportRow): string {
  return (
    row.supplier?.nomeFantasia ??
    row.supplier?.razaoSocial ??
    row.employee?.nome ??
    ''
  )
}

/** Extrai NFe das notas se padrão "NF: 1234" — heurística simples. */
function extractNFe(notes: string | null | undefined): string {
  if (!notes) return ''
  const match = notes.match(/(?:NF|NFE|NF-e|Nota)[:\s]*(\d+)/i)
  return match ? match[1] : ''
}

/** Constrói uma linha CSV a partir de uma row. */
export function buildCSVRow(row: ExportRow): string {
  const visual = payableVisualStatus({
    status: row.status,
    dueDate: row.dueDate,
    paymentDate: row.paymentDate,
  })
  const cells = [
    payableStatusLabel(visual),
    formatDateBR(row.dueDate),
    formatDateBR(row.paymentDate),
    favorecidoNome(row),
    favorecidoTipoLabel(row.favorecidoType),
    row.description,
    row.category?.name ?? '',
    row.category?.dreGroup ?? '',
    extractNFe(row.notes),
    row.bankAccount?.bankName ?? row.bankAccount?.name ?? '',
    '', // Forma Pagamento — não temos campo dedicado ainda
    formatNumberBR(row.amount),
    row.notes ?? '',
  ]
  return cells.map(escapeCSV).join(SEPARATOR)
}

/** Constrói o CSV completo (BOM + header + rows). */
export function buildPayableCSV(rows: ExportRow[]): string {
  return (
    BOM +
    CSV_HEADERS.map(escapeCSV).join(SEPARATOR) +
    LINE_BREAK +
    rows.map(buildCSVRow).join(LINE_BREAK) +
    (rows.length > 0 ? LINE_BREAK : '')
  )
}

/** Gera nome de arquivo: contas-pagar-{slug}-{YYYY-MM-DD}.csv */
export function buildCSVFilename(
  empresaName: string,
  date: Date = new Date(),
): string {
  const slug = empresaName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `contas-pagar-${slug || 'export'}-${y}-${m}-${d}.csv`
}
