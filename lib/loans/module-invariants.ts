// Sprint Fase 3 CAMADA 2/3 (15/08/2026) — os invariantes do módulo de empréstimo
// como FUNÇÃO PURA (dono único). Usada pelo golden test (CAMADA 2) E pelo juiz
// noturno (CAMADA 3). Um invariante ERRADO é pior que nenhum (REGRA 7) — cada um
// aqui foi validado contra os 9 contratos reais + os PDFs oficiais.
//
// I2 (companyId) e I6 (tx não-compartilhada) são checados contra o BANCO no cron
// (precisam de dados que o fixture não carrega — companyId e tx ids). Aqui ficam
// os 6 computáveis a partir da estrutura da agenda.

import { saldoDevedorAtual } from './saldo'

export interface InvInstallment {
  number: number
  dueDate: string
  status: string
  openingBalance: number
  amortization: number
  interest: number
  correcao: number
  payment: number
  closingBalance: number
  paidTotal: number | null
  paidInterest: number | null
  paidCorrection: number | null
  paidPenalty: number | null
  hasReconciled: boolean
  paymentsCount: number
  paymentsSum: number
}
export interface InvLoan {
  contractNumber: string | null
  rateType: string | null
  scheduleSource: string | null
  termMonths: number
  installmentsPaidBefore: number
  interestRateMonthly: number
  principal: number
  installments: InvInstallment[]
}
export interface InvResult { contract: string; pass: boolean; fails: string[] }

const TOL = 0.02

/** Roda os 6 invariantes estruturais contra os contratos. Função pura. */
export function checkModuleInvariants(loans: InvLoan[]): InvResult[] {
  return loans.map((l) => {
    const flex = l.scheduleSource === 'FLEXIBLE'
    const fails: string[] = []

    // I1 — nenhuma PAID com vínculo 1:1 E ponte N:1 (double-count de juros)
    if (l.installments.some((i) => i.status === 'PAID' && i.hasReconciled && i.paymentsCount > 0)) fails.push('I1')

    // I3 — agenda completa (exceto FLEXIBLE)
    if (!flex && l.installments.length !== l.termMonths) fails.push('I3')

    // I4 — saldo devedor computável; non-flex → closing da última PAID == saldoDevedorAtual
    const s = saldoDevedorAtual(
      {
        principal: l.principal,
        installmentsPaidBefore: l.installmentsPaidBefore,
        interestRateMonthly: l.interestRateMonthly,
        rateType: l.rateType,
        scheduleSource: l.scheduleSource,
      },
      l.installments,
    )
    if (!Number.isFinite(s)) fails.push('I4')
    else if (!flex) {
      const paid = l.installments.filter((i) => i.status === 'PAID').sort((a, b) => a.number - b.number)
      if (paid.length && Math.abs(paid[paid.length - 1].closingBalance - s) > TOL) fails.push('I4')
    }

    // I5 — PAID linkada com pago > amort → o juros TEM que estar capturado (bug #2/#23)
    for (const i of l.installments) {
      if (i.status !== 'PAID') continue
      if (!i.hasReconciled && i.paymentsCount === 0) continue
      const realPaid = i.paymentsCount > 0 ? i.paymentsSum : (i.paidTotal ?? i.payment)
      if (realPaid - i.amortization > TOL) {
        const juros =
          (i.paidInterest ?? 0) + (i.paidCorrection ?? 0) + (i.paidPenalty ?? 0) +
          (i.hasReconciled ? (i.interest ?? 0) + (i.correcao ?? 0) : 0)
        if (juros <= 0.01) fails.push(`I5(#${i.number})`)
      }
    }

    // I7 — schedule são: amort/payment não-negativos
    if (l.installments.some((i) => i.amortization < -0.01 || i.payment < -0.01)) fails.push('I7')

    // I8 — N:1: paidTotal bate com a soma dos pagamentos
    for (const i of l.installments) {
      if (i.status === 'PAID' && i.paymentsCount > 0 && i.paidTotal != null && Math.abs(i.paidTotal - i.paymentsSum) > TOL) {
        fails.push(`I8(#${i.number})`)
      }
    }

    return { contract: l.contractNumber ?? 'FLEX', pass: fails.length === 0, fails }
  })
}
