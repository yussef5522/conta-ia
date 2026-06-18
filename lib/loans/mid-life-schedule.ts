// Sprint Empréstimos AI/Contrato (17/06/2026).
//
// Gera SOMENTE as parcelas FUTURAS de um empréstimo que entra EM ANDAMENTO.
//
// Princípio crítico:
//   - Passivo entra = outstandingBalanceInitial (saldo devedor ATUAL),
//     NÃO o principal original.
//   - Parcelas já pagas ANTES da entrada são SÓ histórico informativo
//     (installmentsPaidBefore) — não geram tx, não entram no DRE.
//   - Pré-fixado: juros = saldo * taxa; amortização = constante (SAC).
//   - Pós-fixado: juros pré + correção (CDI/SELIC/IPCA) = ESTIMATIVAS;
//     correção será recalculada na conciliação quando o debito real cair.
//   - Função PURA — caller cria as installments no DB.

import { addMonths } from './amortization'

export interface MidLifeScheduleInput {
  /** Saldo devedor atual (na entrada do sistema) */
  outstandingBalance: number
  /** Amortização constante (SAC). Pra PRICE, calculamos PMT a partir do saldo. */
  amortizationConstant?: number
  /** Taxa pré mensal (0.0035 = 0,35% a.m.) */
  rateMonthly: number
  /** Quantas parcelas FUTURAS gerar */
  futureCount: number
  /** Número da PRÓXIMA parcela (ex: 56 quando 55 já foram pagas) */
  startNumber: number
  /** Data da primeira parcela futura */
  firstDueDate: Date
  system: 'PRICE' | 'SAC'
  /** Pós-fixado: marca parcela como ESTIMATE (valor real vem na conciliação) */
  isPostFixed?: boolean
  /** Estimativa de correção mensal pra pós-fixado (CDI esperado, opcional).
   *  Quando 0/undefined, parcela estimada tem correcao=0 (juros pré só).
   *  Recalculado na conciliação. */
  estimatedCorrectionMonthly?: number
  /**
   * Sprint Fix-Previa (17/06/2026) — overrides de payment vindos do PDF
   * (valor LÍQUIDO da parcela, após descontos). Usar quando o contrato já
   * traz a estimativa precisa pra cada parcela futura. Engine usa esse
   * payment, mantém amortização constante e RECALCULA correção =
   * payment - amort - interest pra refletir a estimativa.
   *
   * Mapa: number → payment (líquido). Parcelas sem override usam o cálculo
   * padrão (amort + interest + correção estimada uniforme).
   */
  paymentOverrides?: Map<number, number>
}

export interface MidLifeScheduleRow {
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

export function generateMidLifeSchedule(input: MidLifeScheduleInput): MidLifeScheduleRow[] {
  const {
    outstandingBalance,
    rateMonthly,
    futureCount,
    startNumber,
    firstDueDate,
    system,
    isPostFixed = false,
    estimatedCorrectionMonthly = 0,
  } = input

  if (!(outstandingBalance > 0)) throw new Error('outstandingBalance deve ser > 0')
  if (!(rateMonthly >= 0)) throw new Error('rateMonthly inválida')
  if (!Number.isInteger(futureCount) || futureCount < 1) {
    throw new Error('futureCount deve ser inteiro >= 1')
  }
  if (!Number.isInteger(startNumber) || startNumber < 1) {
    throw new Error('startNumber deve ser inteiro >= 1')
  }

  const rows: MidLifeScheduleRow[] = []
  let saldo = round2(outstandingBalance)

  if (system === 'PRICE') {
    const pmt =
      rateMonthly === 0
        ? outstandingBalance / futureCount
        : (outstandingBalance * rateMonthly) /
          (1 - Math.pow(1 + rateMonthly, -futureCount))
    const pmtR = round2(pmt)
    for (let k = 0; k < futureCount; k++) {
      const isLast = k === futureCount - 1
      const juros = round2(saldo * rateMonthly)
      const amort = isLast ? round2(saldo) : round2(pmtR - juros)
      const number = startNumber + k
      const override = input.paymentOverrides?.get(number)
      let correcao: number
      let payment: number
      if (override !== undefined && override > 0) {
        payment = round2(override)
        correcao = round2(payment - amort - juros)
      } else {
        correcao = isPostFixed
          ? round2(saldo * estimatedCorrectionMonthly)
          : 0
        payment = round2(amort + juros + correcao)
      }
      const closing = round2(saldo - amort)
      rows.push({
        number,
        dueDate: addMonths(firstDueDate, k),
        openingBalance: saldo,
        interest: juros,
        amortization: amort,
        correcao,
        payment,
        closingBalance: closing,
        isEstimate: isPostFixed,
      })
      saldo = closing
    }
  } else {
    // SAC: amortização constante. Caller passa amortizationConstant; se omitido,
    // recalcula pelo saldo / parcelas restantes.
    const amortBase =
      input.amortizationConstant && input.amortizationConstant > 0
        ? round2(input.amortizationConstant)
        : round2(outstandingBalance / futureCount)

    for (let k = 0; k < futureCount; k++) {
      const isLast = k === futureCount - 1
      const juros = round2(saldo * rateMonthly)
      const amort = isLast ? round2(saldo) : amortBase
      const number = startNumber + k
      const override = input.paymentOverrides?.get(number)
      let correcao: number
      let payment: number
      if (override !== undefined && override > 0) {
        // Override do PDF (valor líquido): mantém amort + juros pré; correção
        // é o que sobra. Pode ser negativa quando há desconto pesado.
        payment = round2(override)
        correcao = round2(payment - amort - juros)
      } else {
        correcao = isPostFixed
          ? round2(saldo * estimatedCorrectionMonthly)
          : 0
        payment = round2(amort + juros + correcao)
      }
      const closing = round2(saldo - amort)
      rows.push({
        number,
        dueDate: addMonths(firstDueDate, k),
        openingBalance: saldo,
        interest: juros,
        amortization: amort,
        correcao,
        payment,
        closingBalance: closing,
        isEstimate: isPostFixed,
      })
      saldo = closing
    }
  }

  return rows
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Recalcula juros + correção + saldo de uma parcela ESTIMATE quando ela
 * vira PAID com um valor REAL diferente da estimativa.
 *
 * Pós-fixado real:
 *   amortização = constante (SAC) — fixa pelo contrato
 *   juros = openingBalance * taxaPreMensal — fixo pelo contrato
 *   correção = realPayment - amortização - juros
 *   closingBalance = openingBalance - amortização
 *
 * DRE: despesa financeira = juros + correção (ambos não-amortização);
 *      amortização fora (baixa de passivo).
 */
export interface RecalcOnConciliateInput {
  openingBalance: number
  amortization: number
  rateMonthly: number
  realPayment: number
}

export interface RecalcOnConciliateResult {
  interest: number
  correcao: number
  closingBalance: number
  /** Soma juros + correcao — vai como loanInterestSplit pro DRE */
  loanInterestSplit: number
}

export function recalcOnConciliate(input: RecalcOnConciliateInput): RecalcOnConciliateResult {
  const interest = round2(input.openingBalance * input.rateMonthly)
  const correcao = round2(input.realPayment - input.amortization - interest)
  const closingBalance = round2(input.openingBalance - input.amortization)
  const loanInterestSplit = round2(interest + correcao)
  return { interest, correcao, closingBalance, loanInterestSplit }
}
