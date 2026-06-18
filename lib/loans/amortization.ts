// Sprint Empréstimos Backend (17/06/2026) — motor de amortização puro.
//
// Sistemas suportados:
//   - PRICE: parcela fixa (PMT). juros = saldo × i; amortização = PMT − juros.
//     PMT = P × i / (1 − (1 + i)^-n)
//   - SAC:   amortização constante (P / n). juros = saldo × i; parcela decresce.
//
// CONTRATO:
//   - Arredondamento 2 casas decimais (centavos).
//   - ÚLTIMA parcela ajustada pra zerar o saldo (sem resíduo de centavo).
//   - SUM(amortization) === principal exato. ESSA é a invariante crítica
//     pro DRE: "amortização baixa o passivo (NÃO é despesa)" — se sumir 1¢,
//     o passivo nunca zera. Testes verificam.
//   - Função PURA: sem DB, sem efeitos colaterais.

export type AmortizationSystem = 'PRICE' | 'SAC'

export interface ScheduleRow {
  number: number          // 1, 2, …, termMonths
  dueDate: Date
  openingBalance: number  // saldo devedor antes da parcela
  interest: number
  amortization: number
  payment: number         // interest + amortization
  closingBalance: number  // openingBalance − amortization (zera na última)
}

export interface GenerateScheduleInput {
  principal: number       // valor liberado (sem IOF)
  rateMonthly: number     // 0.025 = 2.5% a.m.
  termMonths: number      // 1..360
  system: AmortizationSystem
  firstDueDate: Date      // data da 1ª parcela
}

export function generateSchedule(input: GenerateScheduleInput): ScheduleRow[] {
  const { principal, rateMonthly, termMonths, system, firstDueDate } = input

  if (!(principal > 0)) throw new Error('principal deve ser > 0')
  if (rateMonthly < 0) throw new Error('rateMonthly não pode ser negativa')
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new Error('termMonths deve ser inteiro >= 1')
  }
  if (system !== 'PRICE' && system !== 'SAC') {
    throw new Error(`system inválido: ${system}`)
  }

  const rows: ScheduleRow[] = []
  let saldo = round2(principal)

  if (system === 'PRICE') {
    const pmt = computePricePMT(principal, rateMonthly, termMonths)
    const pmtRounded = round2(pmt)
    for (let n = 1; n <= termMonths; n++) {
      const isLast = n === termMonths
      const juros = round2(saldo * rateMonthly)
      let amort: number
      let payment: number
      if (isLast) {
        // Última parcela: amortiza o saldo restante exato; ajusta payment.
        amort = round2(saldo)
        payment = round2(amort + juros)
      } else {
        amort = round2(pmtRounded - juros)
        payment = pmtRounded
      }
      const closing = round2(saldo - amort)
      rows.push({
        number: n,
        dueDate: addMonths(firstDueDate, n - 1),
        openingBalance: saldo,
        interest: juros,
        amortization: amort,
        payment,
        closingBalance: closing,
      })
      saldo = closing
    }
  } else {
    // SAC: amort constante = P / n
    const amortBase = round2(principal / termMonths)
    for (let n = 1; n <= termMonths; n++) {
      const isLast = n === termMonths
      const juros = round2(saldo * rateMonthly)
      const amort = isLast ? round2(saldo) : amortBase
      const payment = round2(amort + juros)
      const closing = round2(saldo - amort)
      rows.push({
        number: n,
        dueDate: addMonths(firstDueDate, n - 1),
        openingBalance: saldo,
        interest: juros,
        amortization: amort,
        payment,
        closingBalance: closing,
      })
      saldo = closing
    }
  }

  return rows
}

// PMT do sistema PRICE.
// PMT = P × i / (1 − (1 + i)^-n)
// Quando i==0: PMT = P / n (sem juros).
export function computePricePMT(
  principal: number,
  rateMonthly: number,
  termMonths: number,
): number {
  if (rateMonthly === 0) return principal / termMonths
  const factor = 1 - Math.pow(1 + rateMonthly, -termMonths)
  return (principal * rateMonthly) / factor
}

function round2(n: number): number {
  // Math.round trata ±0.5 conforme banker's rounding em algumas plataformas.
  // Usamos arredondamento half-up explicit pra ser previsível em testes.
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Adiciona N meses preservando o dia. Quando o dia não existe no mês alvo
 * (ex: 31/jan + 1 mês = 28/fev), encolhe pro último dia válido. Mantém UTC.
 */
export function addMonths(base: Date, n: number): Date {
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth() + n
  const d = base.getUTCDate()
  const targetMonthLastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const day = Math.min(d, targetMonthLastDay)
  return new Date(
    Date.UTC(
      y,
      m,
      day,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  )
}

/** Soma das amortizações (deve ser exatamente === principal). */
export function sumAmortizations(rows: ScheduleRow[]): number {
  let s = 0
  for (const r of rows) s = round2(s + r.amortization)
  return s
}

/** Saldo devedor atual = principal − SUM(amortizações das parcelas PAID). */
export function computeOutstandingBalance(
  principal: number,
  paidAmortizations: number[],
): number {
  let s = round2(principal)
  for (const a of paidAmortizations) s = round2(s - a)
  return s
}
