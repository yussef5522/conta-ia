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
  /** mês de competência que o DRE atribui a esta parcela quando vinculada (data
   *  da tx no 1:1, paidDate no N:1). null quando NÃO vinculada — nesse caso o
   *  encargo NÃO entra no DRE (só reconstrói saldo/agenda). */
  competenceMonth: string | null
  /** encargo que HOJE está no DRE por esta parcela (0 se sem vínculo/sem split). */
  currentEncargo: number
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
  // ── IMPACTO REAL NO DRE — SÓ parcelas VINCULADAS (1:1 ou N:1) por competência ──
  dreImpactByMonth: Array<{ month: string; antes: number; depois: number; parcelas: number }>
  dreImpactTotalAntes: number
  dreImpactTotalDepois: number
  // ── RECONSTRUÇÃO DE HISTÓRICO — liquidadas SEM vínculo: NÃO afetam o resultado ──
  historicoSemVinculoCount: number
  historicoEncargos: number
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

  // IMPACTO REAL NO DRE: o DRE só reinjeta encargo de parcela VINCULADA (1:1/N:1).
  // Liquidada-pelo-documento SEM vínculo NÃO entra no resultado — é só reconstrução
  // de saldo/agenda. Separa as duas coisas pra o preview não mentir.
  const impactMap = new Map<string, { antes: number; depois: number; parcelas: number }>()
  let historicoSemVinculoCount = 0
  let historicoEncargos = 0
  for (const r of rows) {
    if (r.status !== 'PAID' || !(r.paidInterest != null && r.paidInterest > 0)) continue
    const ex = byNumberExisting.get(r.number)
    const linked = !!ex && (ex.reconciledTransactionId != null || ex.hasNPayments)
    if (linked) {
      const month = ex!.competenceMonth ?? r.dueDate.slice(0, 7)
      const cur = impactMap.get(month) ?? { antes: 0, depois: 0, parcelas: 0 }
      cur.antes = round2(cur.antes + (ex!.currentEncargo || 0))
      cur.depois = round2(cur.depois + r.paidInterest!)
      cur.parcelas += 1
      impactMap.set(month, cur)
    } else {
      historicoSemVinculoCount += 1
      historicoEncargos = round2(historicoEncargos + r.paidInterest!)
    }
  }
  const dreImpactByMonth = [...impactMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }))
  const dreImpactTotalAntes = round2(dreImpactByMonth.reduce((s, m) => s + m.antes, 0))
  const dreImpactTotalDepois = round2(dreImpactByMonth.reduce((s, m) => s + m.depois, 0))

  // Bloqueio: parcela JÁ VINCULADA (1:1 ou N:1) que some do documento (número
  // fora da nova agenda) → não pode perder o vínculo.
  const linkedLost = installments.filter(
    (i) => (i.reconciledTransactionId != null || i.hasNPayments) && !newNumbers.has(i.number),
  )
  const blocked = linkedLost.length > 0
  const blockReason = blocked
    ? `${linkedLost.length} parcela(s) já vinculada(s) (ex #${linkedLost[0].number}) não existem na agenda do documento — o vínculo seria perdido. Confira se é o documento certo do contrato.`
    : null

  return {
    rows, saldoDepois: round2(contract.saldoDevedor), pagasDepois: rows.filter((r) => r.status === 'PAID').length,
    dreImpactByMonth, dreImpactTotalAntes, dreImpactTotalDepois, historicoSemVinculoCount, historicoEncargos,
    blocked, blockReason,
  }
}
