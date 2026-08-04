// Sprint Empréstimo Débito Parcial (03/08/2026) — PASSO 4: regenera a agenda de
// um empréstimo já cadastrado a partir da parcela + taxa REAIS do carnê, sem
// gravar. Roda o mesmo gerador + guard da criação, e mapeia o impacto nas
// parcelas RECONCILIADAS (a caçula tem 7) — regenerar não pode perder vínculo.
//
// Se alguma parcela reconciliada some do novo cronograma → `blocked` (a rota
// bloqueia em vez de gravar). Função PURA — sem DB; caller passa loan+parcelas.

import { generateMidLifeSchedule } from './mid-life-schedule'
import { validateSchedule, InvalidLoanScheduleError } from './validate-schedule'
import { computePosFixedSplit, computePreFixedSplit } from './installment-match'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface RegenLoan {
  principal: number
  outstandingBalanceInitial: number | null
  termMonths: number
  installmentsPaidBefore: number
  amortizationSystem: 'PRICE' | 'SAC'
  amortizationConstant: number | null
  financedAmount: number | null
  firstDueDate: Date
}

export interface RegenInstallment {
  number: number
  dueDate: Date
  openingBalance: number
  interest: number
  amortization: number
  correcao: number
  payment: number
  closingBalance: number
  status: string
  isEstimate: boolean
  reconciledTransactionId: string | null
  realPayment: number | null
  /** valor REAL debitado (amount da tx reconciliada) — fonte de verdade quando
   *  realPayment é null (parcela reconciliada por caminho antigo). */
  reconciledTxAmount: number | null
}

export interface RegenInput {
  /** SAC (amortização constante) ou PRICE (parcela fixa). */
  system: 'SAC' | 'PRICE'
  rateMonthly: number
  isPostFixed: boolean
  /** PRICE: valor real da parcela (carnê). Ignorado no SAC. */
  parcela?: number
  /** SAC: valor FINANCIADO (base da amortização). amort = financedAmount / termMonths. */
  financedAmount?: number
}

export interface RegenRow {
  number: number
  dueDate: Date
  openingBalance: number
  interest: number
  amortization: number
  correcao: number
  payment: number
  closingBalance: number
  isEstimate: boolean
}

export interface ReconciliationImpact {
  number: number
  reconciledTransactionId: string
  realPayment: number
  antes: { interest: number; amortization: number; correcao: number }
  /** null quando a parcela some do novo cronograma (não preservável). */
  depois: { interest: number; amortization: number; correcao: number } | null
  preserved: boolean
}

export interface RegenResult {
  rows: RegenRow[]
  validation: { ok: boolean; errors: string[] }
  base: number
  ratePositive: boolean
  reconciled: ReconciliationImpact[]
  blocked: boolean
  blockReason: string | null
}

export function regenerateSchedule(
  loan: RegenLoan,
  installments: RegenInstallment[],
  input: RegenInput,
): RegenResult {
  const futureCount = loan.termMonths - loan.installmentsPaidBefore
  const startNumber = loan.installmentsPaidBefore + 1
  const firstFuture = installments.find((i) => i.number === startNumber)
  const firstDueDate = firstFuture?.dueDate ?? loan.firstDueDate

  // Base da faixa rastreada + parâmetros do gerador, por sistema.
  //   SAC:   amort constante = financedAmount / termMonths (regra validada nos 3
  //          bancos). A base rastreada = financedAmount − amortizações já pagas
  //          antes de entrar no sistema.
  //   PRICE: base = saldo devedor inicial; parcela fixa do carnê fecha a agenda.
  let base: number
  let amortizationConstant: number | undefined
  let fixedPayment: number | undefined
  if (input.system === 'SAC') {
    const financed = input.financedAmount ?? loan.financedAmount ?? loan.outstandingBalanceInitial ?? loan.principal
    // Bancos TRUNCAM a amortização a centavos (150.000/36 = 4.166,66, não 4.166,67).
    // O resíduo acumulado é absorvido pela última parcela (gerador zera o saldo).
    amortizationConstant = Math.floor((financed / loan.termMonths) * 100) / 100
    base = round2(financed - loan.installmentsPaidBefore * amortizationConstant)
  } else {
    base = loan.outstandingBalanceInitial ?? loan.principal
    fixedPayment = input.parcela
  }

  let rows: RegenRow[] = []
  let validation: { ok: boolean; errors: string[] }
  try {
    const sched = generateMidLifeSchedule({
      outstandingBalance: base,
      rateMonthly: input.rateMonthly,
      futureCount,
      startNumber,
      firstDueDate,
      system: input.system,
      amortizationConstant,
      isPostFixed: input.isPostFixed,
      fixedPayment,
    })
    rows = sched.map((r) => ({
      number: r.number,
      dueDate: r.dueDate,
      openingBalance: r.openingBalance,
      interest: r.interest,
      amortization: r.amortization,
      correcao: r.correcao,
      payment: r.payment,
      closingBalance: r.closingBalance,
      isEstimate: r.isEstimate,
    }))
    validation = validateSchedule({
      rows,
      base,
      ratePositive: input.rateMonthly > 0,
      isPostFixed: input.isPostFixed,
    })
  } catch (err) {
    if (err instanceof InvalidLoanScheduleError) validation = { ok: false, errors: err.errors }
    else validation = { ok: false, errors: [err instanceof Error ? err.message : 'erro ao gerar agenda'] }
  }

  // Impacto nas reconciliadas: recomputa o split com a amortização NOVA, usando
  // o valor REAL debitado (realPayment) — nunca a estimativa (passo 5).
  const newByNumber = new Map(rows.map((r) => [r.number, r]))
  const reconciled: ReconciliationImpact[] = installments
    .filter((i) => i.reconciledTransactionId)
    .map((i) => {
      const nr = newByNumber.get(i.number)
      // Valor REAL debitado: realPayment > amount da tx reconciliada > payment
      // do cronograma. O fallback pro tx amount é crítico — parcelas reconciliadas
      // por caminho antigo têm realPayment null e o payment é a estimativa velha.
      const realPayment = i.realPayment ?? i.reconciledTxAmount ?? i.payment
      let depois: ReconciliationImpact['depois'] = null
      if (nr) {
        const split = input.isPostFixed
          ? computePosFixedSplit({ amortization: nr.amortization, openingBalance: nr.openingBalance }, realPayment, input.rateMonthly)
          : computePreFixedSplit({ interest: nr.interest, amortization: nr.amortization, payment: nr.payment, openingBalance: nr.openingBalance })
        depois = { interest: split.interest, amortization: nr.amortization, correcao: split.correcao }
      }
      return {
        number: i.number,
        reconciledTransactionId: i.reconciledTransactionId!,
        realPayment,
        antes: { interest: i.interest, amortization: i.amortization, correcao: i.correcao },
        depois,
        preserved: !!nr,
      }
    })

  const lost = reconciled.filter((x) => !x.preserved)
  const blocked = lost.length > 0
  const blockReason = blocked
    ? `${lost.length} parcela(s) reconciliada(s) (ex #${lost[0].number}) somem do novo cronograma — o vínculo com a transação bancária não pode ser preservado. Revise prazo/parcelas pagas antes.`
    : null

  return { rows, validation, base, ratePositive: input.rateMonthly > 0, reconciled, blocked, blockReason }
}
