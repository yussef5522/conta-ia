// Sprint Importar Agenda (04/08/2026) — interface GENÉRICA de parser de agenda
// de empréstimo por banco. Sicredi agora; Caixa e Banrisul entram depois com
// documentos equivalentes (mesmo shape de saída). Determinístico, sem IA.

export interface ParsedScheduleInstallment {
  number: number
  situacao: 'LIQUIDADO' | 'NORMAL'
  dueDate: string // ISO YYYY-MM-DD
  /** encargos já provisionados (informativo). */
  encargosProvisionados: number
  /** encargos totais = juros + correção. 0 em parcela NORMAL futura (o banco só
   *  calcula na data de capitalização — esperado em pós-fixado, não é erro). */
  encargosTotais: number
  /** valor principal = amortização (baixa de passivo). */
  valorPrincipal: number
  /** valor da parcela = total. Em LIQUIDADO é o efetivamente pago; em NORMAL é só
   *  o principal (encargos ainda 0). */
  valorParcela: number
}

export interface ParsedScheduleContract {
  contractNumber: string
  numParcelas: number
  dataContratacao: string | null // ISO
  saldoDevedor: number
  valorFinanciado: number
  jurosNormaisAnual: number | null
  installments: ParsedScheduleInstallment[]
}

export interface BankScheduleParser {
  bank: string
  /** Parseia UM arquivo que pode conter VÁRIOS contratos. */
  parse(text: string): ParsedScheduleContract[]
}

// ── helpers pt-BR compartilhados ──
export function parseBRNumber(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'))
}
export function brDateToISO(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m}-${d}`
}
