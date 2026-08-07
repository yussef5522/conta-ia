// Sprint Importar Agenda (04/08/2026) — interface GENÉRICA de parser de agenda
// de empréstimo por banco. Sicredi agora; Caixa e Banrisul entram depois com
// documentos equivalentes (mesmo shape de saída). Determinístico, sem IA.

export interface ParsedScheduleInstallment {
  number: number
  situacao: 'LIQUIDADO' | 'NORMAL'
  dueDate: string // ISO YYYY-MM-DD
  /** encargos já provisionados (informativo). */
  encargosProvisionados: number
  /** encargos totais = juros + correção (+ enc. atraso + resíduo, na Caixa). 0 em
   *  parcela NORMAL futura (o banco só calcula na data de capitalização — esperado
   *  em pós-fixado, não é erro). Em LIQUIDADO = total pago − amortização. */
  encargosTotais: number
  /** valor principal = amortização (baixa de passivo). */
  valorPrincipal: number
  /** valor da parcela = total. Em LIQUIDADO é o efetivamente pago; em NORMAL é só
   *  o principal (encargos ainda 0). */
  valorParcela: number
  // ── Detalhamento OPCIONAL do encargo (Caixa) — só pra preview honesto. Soma
  //    ≡ encargosTotais em LIQUIDADO. Não usado no cálculo de saldo. ──
  /** juros do movimento (Tipo=Juros). */
  juros?: number
  /** encargo por atraso (sub-linha "ENC. POR ATRASO"). */
  encAtraso?: number
  /** resíduo = total pago − amort − juros − enc. Segundo encargo de mora que o
   *  relatório não lista como linha. >= 0 sempre (negativo = leitura errada). */
  residuo?: number
}

/** Meses de carência: juro capitalizado no saldo, NÃO é parcela paga, fora do DRE. */
export interface ParsedCarencia {
  count: number
  jurosCapitalizadoTotal: number
  saldoInicial: number
  saldoFinal: number
}

export interface ParsedScheduleContract {
  contractNumber: string
  numParcelas: number
  dataContratacao: string | null // ISO
  saldoDevedor: number
  valorFinanciado: number
  jurosNormaisAnual: number | null
  installments: ParsedScheduleInstallment[]
  // ── Campos OPCIONAIS lidos do documento (Caixa) — informativos pro preview. ──
  sistemaAmortizacao?: 'PRICE' | 'SAC' | null
  taxaJurosMensal?: number | null
  /** indexador do pós-fixado (ex: 'SELIC'); null/undefined = pré-fixado. */
  indexador?: string | null
  carencia?: ParsedCarencia | null
}

export interface BankScheduleParser {
  bank: string
  /** true quando o texto extraído é deste banco (roteamento de layout). */
  detects(text: string): boolean
  /** Parseia UM arquivo que pode conter VÁRIOS contratos (Caixa = 1). */
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
