// Geração de CSV de transações — Sprint 3.0.4 C1.
// Mesmo padrão de lib/audit-csv: BOM UTF-8 + separador vírgula + escape RFC 4180.

export interface TransacaoCsvRow {
  id: string
  date: Date | string
  description: string
  amount: number
  type: string // CREDIT | DEBIT | TRANSFER
  status: string
  classificationSource: string | null
  aiConfidence: number | null
  category: { name: string } | null
  supplier: { razaoSocial: string; nomeFantasia: string | null } | null
  classifiedByRule: { padrao: string } | null
  bankAccount: {
    name: string
    bankName: string | null
    company: { name: string; tradeName: string | null }
  }
}

const HEADERS = [
  'Data',
  'Descrição',
  'Valor',
  'Tipo',
  'Status',
  'Categoria',
  'Fornecedor',
  'Source IA',
  'Confiança IA',
  'Regra Aplicada',
  'Empresa',
  'Conta',
]

const SOURCE_LABELS: Record<string, string> = {
  RULE: 'Regra',
  KEYWORD: 'Keyword',
  CLAUDE: 'IA Claude',
  BRASILAPI: 'BrasilAPI',
  MANUAL: 'Manual',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  RECONCILED: 'Conciliado',
  IGNORED: 'Ignorado',
}

const TYPE_LABELS: Record<string, string> = {
  CREDIT: 'Entrada',
  DEBIT: 'Saída',
  TRANSFER: 'Transferência',
}

function escapeCsvField(value: string): string {
  if (value == null) return ''
  const str = String(value)
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.includes(';')
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatAmount(amount: number, type: string): string {
  // Excel BR: vírgula como separador decimal. Aspas envolvem campos com vírgula.
  const sign = type === 'CREDIT' ? '' : type === 'DEBIT' ? '-' : ''
  const fixed = amount.toFixed(2).replace('.', ',')
  return `${sign}${fixed}`
}

function formatConfidence(c: number | null): string {
  if (c === null || c === undefined) return ''
  return `${Math.round(c * 100)}%`
}

function formatSupplier(
  s: { razaoSocial: string; nomeFantasia: string | null } | null,
): string {
  if (!s) return ''
  return s.nomeFantasia ?? s.razaoSocial
}

export function generateTransacoesCSV(rows: TransacaoCsvRow[]): string {
  const dataRows = rows.map((t) => [
    formatDate(t.date),
    t.description,
    formatAmount(t.amount, t.type),
    TYPE_LABELS[t.type] ?? t.type,
    STATUS_LABELS[t.status] ?? t.status,
    t.category?.name ?? '',
    formatSupplier(t.supplier),
    t.classificationSource ? SOURCE_LABELS[t.classificationSource] ?? t.classificationSource : '',
    formatConfidence(t.aiConfidence),
    t.classifiedByRule?.padrao ?? '',
    t.bankAccount.company.tradeName ?? t.bankAccount.company.name,
    `${t.bankAccount.bankName ?? ''} · ${t.bankAccount.name}`.replace(/^ · /, ''),
  ])

  // BOM UTF-8 pra Excel BR
  const BOM = '﻿'
  return (
    BOM +
    [HEADERS, ...dataRows]
      .map((row) => row.map(escapeCsvField).join(','))
      .join('\r\n')
  )
}

// Filename padrão: "transacoes-{slug-empresa}-{YYYYMMDD}.csv".
// Usa UTC pra evitar TZ shift entre dev (BRT) e prod (UTC).
export function transacoesCsvFilename(
  empresaName: string | null | undefined,
  date: Date = new Date(),
): string {
  const slug = empresaName
    ? empresaName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'export'
    : 'export'
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `transacoes-${slug}-${yyyy}${mm}${dd}.csv`
}
