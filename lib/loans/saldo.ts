// Sprint Casar Pagamento — FIX saldo (04/08/2026). Fonte de verdade ÚNICA do
// saldo devedor exibido (card, detalhe, dashboard "Dívida total").
//
// Bug corrigido: o card fazia `principal − Σamort(PAID)`. Após corrigir a agenda,
// `loan.principal` (saldo de entrada) ficou desalinhado com a agenda regenerada,
// e a fórmula descontava a 1ª parcela rastreada DUAS vezes → off-by-one.
//
// Regra: quando a agenda FECHA (é consistente), o `closingBalance` da última
// parcela paga é a verdade (no C41022570 = 100.000,08 = documento). Quando a
// agenda NÃO fecha (quebrada/não corrigida), o closingBalance é lixo (ex balão
// zera o saldo cedo) — aí caímos na fórmula conservadora `principal − Σpaid`,
// que não muda o valor atual desses contratos até o usuário corrigir a agenda.
// Função PURA.

import { validateSchedule } from './validate-schedule'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface SaldoLoan {
  principal: number
  installmentsPaidBefore: number
  interestRateMonthly: number
  rateType: string | null
}
export interface SaldoInstallment {
  number: number
  status: string
  openingBalance: number
  interest: number
  amortization: number
  correcao: number
  payment: number
  closingBalance: number
}

export function saldoDevedorAtual(loan: SaldoLoan, installments: SaldoInstallment[]): number {
  const sorted = [...installments].sort((a, b) => a.number - b.number)
  const tracked = sorted.filter((i) => i.number > loan.installmentsPaidBefore)
  const base = tracked[0]?.openingBalance ?? 0
  const agendaFecha =
    tracked.length > 0 &&
    validateSchedule({ rows: tracked, base, ratePositive: loan.interestRateMonthly > 0, isPostFixed: loan.rateType === 'POS' }).ok

  if (agendaFecha) {
    // Verdade: fechamento da última parcela paga. Sem nenhuma paga → abertura
    // da 1ª rastreada (1.3).
    const paid = sorted.filter((i) => i.status === 'PAID')
    if (paid.length > 0) return round2(paid[paid.length - 1].closingBalance)
    return round2(base)
  }

  // Agenda inválida → fórmula conservadora (não muda o valor atual).
  const paidAmort = round2(sorted.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amortization, 0))
  return round2(loan.principal - paidAmort)
}
