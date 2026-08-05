// Sprint Importar Agenda (04/08/2026) — FASE 2: monta o plano de aplicação da
// agenda OFICIAL do banco sobre um empréstimo cadastrado. NÃO recalcula por
// fórmula — usa os valores do documento verbatim. Reconstrói o encadeamento de
// saldo ANCORADO no saldo devedor do documento (2.4). Preserva vínculos (2.5).
// Função PURA — caller grava no DB.

import type { ParsedScheduleContract } from './bank-schedule-parser'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface ApplyImportLoan {
  contractNumber: string | null
  rateType: string | null
}
export interface ApplyImportInstallment {
  number: number
  status: string
  reconciledTransactionId: string | null
  hasNPayments: boolean
  paidInterest: number | null
}
export interface ImportedRow {
  number: number
  dueDate: string
  openingBalance: number
  interest: number
  amortization: number
  correcao: number
  payment: number
  closingBalance: number
  status: 'PAID' | 'OPEN'
  isEstimate: boolean
  paidTotal: number | null
  paidInterest: number | null
}
export interface ApplyImportResult {
  rows: ImportedRow[]
  saldoDepois: number
  pagasDepois: number
  /** parcelas que passam a ter split no DRE (liquidadas sem split antes). */
  novoSplitDRE: Array<{ number: number; dueDate: string; encargos: number; amort: number }>
  blocked: boolean
  blockReason: string | null
}

export function applyImportedSchedule(
  contract: ParsedScheduleContract,
  loan: ApplyImportLoan,
  installments: ApplyImportInstallment[],
): ApplyImportResult {
  const parsed = [...contract.installments].sort((a, b) => a.number - b.number)
  const n = parsed.length

  // Encadeamento de saldo ANCORADO no saldo devedor do documento.
  // closing da última LIQUIDADA = saldoDevedor; encadeia pra frente (NORMAL) e
  // pra trás (liquidadas anteriores) somando/subtraindo o principal de cada uma.
  const opening = new Array<number>(n)
  const closing = new Array<number>(n)
  let anchor = -1
  for (let i = 0; i < n; i++) if (parsed[i].situacao === 'LIQUIDADO') anchor = i

  if (anchor >= 0) {
    closing[anchor] = round2(contract.saldoDevedor)
    // frente
    for (let i = anchor + 1; i < n; i++) {
      opening[i] = closing[i - 1]
      closing[i] = round2(opening[i] - parsed[i].valorPrincipal)
    }
    // trás
    for (let i = anchor; i >= 0; i--) {
      opening[i] = round2(closing[i] + parsed[i].valorPrincipal)
      if (i > 0) closing[i - 1] = opening[i]
    }
  } else {
    // nenhuma paga → começa no valor financiado
    opening[0] = round2(contract.valorFinanciado)
    for (let i = 0; i < n; i++) {
      if (i > 0) opening[i] = closing[i - 1]
      closing[i] = round2(opening[i] - parsed[i].valorPrincipal)
    }
  }

  const isPos = loan.rateType === 'POS'
  const rows: ImportedRow[] = parsed.map((p, i) => {
    const liquidado = p.situacao === 'LIQUIDADO'
    return {
      number: p.number,
      dueDate: p.dueDate,
      openingBalance: opening[i],
      interest: p.encargosTotais,
      amortization: p.valorPrincipal,
      correcao: 0,
      payment: p.valorParcela,
      closingBalance: closing[i],
      status: liquidado ? 'PAID' : 'OPEN',
      // NORMAL futura em pós-fixado: encargos são estimativa até o banco informar.
      isEstimate: !liquidado && isPos,
      paidTotal: liquidado ? p.valorParcela : null,
      paidInterest: liquidado ? p.encargosTotais : null,
    }
  })

  const byNumberExisting = new Map(installments.map((i) => [i.number, i]))
  const newNumbers = new Set(parsed.map((p) => p.number))

  // Parcelas que GANHAM split no DRE: liquidadas no documento cujo split ainda não
  // existia (não estavam pagas, ou estavam pagas mas com paidInterest null).
  const novoSplitDRE = rows
    .filter((r) => r.status === 'PAID' && r.paidInterest != null && r.paidInterest > 0)
    .filter((r) => {
      const ex = byNumberExisting.get(r.number)
      return !ex || ex.status !== 'PAID' || ex.paidInterest == null
    })
    .map((r) => ({ number: r.number, dueDate: r.dueDate, encargos: r.paidInterest!, amort: r.amortization }))

  // Bloqueio: parcela JÁ VINCULADA (1:1 ou N:1) que some do documento (número
  // fora da nova agenda) → não pode perder o vínculo.
  const linkedLost = installments.filter(
    (i) => (i.reconciledTransactionId != null || i.hasNPayments) && !newNumbers.has(i.number),
  )
  const blocked = linkedLost.length > 0
  const blockReason = blocked
    ? `${linkedLost.length} parcela(s) já vinculada(s) (ex #${linkedLost[0].number}) não existem na agenda do documento — o vínculo seria perdido. Confira se é o documento certo do contrato.`
    : null

  return { rows, saldoDepois: round2(contract.saldoDevedor), pagasDepois: rows.filter((r) => r.status === 'PAID').length, novoSplitDRE, blocked, blockReason }
}
