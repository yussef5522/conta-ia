// Sprint Empréstimo Débito Parcial (03/08/2026) — GUARD de integridade da agenda.
//
// Motivo: todo o split juros × principal do DRE sai da LoanInstallment. Uma
// agenda que não fecha faz o DRE ficar "errado com aparência de certo" — pior
// que sem categoria. Este guard IMPEDE gravar agenda inconsistente.
//
// Bug real encontrado (03/08): mid-life PRICE, quando solveEffectiveRate falha
// (parcela × prazo < saldo), o catch mantinha pmt=parcela com taxa NOMINAL —
// par (pagamento, taxa) que NUNCA fecha → balão na última parcela. Gravava
// calado. Este guard + o fix no gerador fecham o buraco.
//
// Invariantes checadas (todas obrigatórias):
//   1. 1ª parcela abre no saldo-base (principal ou saldo devedor inicial).
//   2. Σ amortizações == base (baixa de passivo tem que zerar o passivo).
//   3. Cadeia de saldo intacta: abertura_k == fechamento_{k-1}.
//   4. Identidade por parcela: payment == juros + amortização + correção.
//   5. Fechamento por parcela: closing == opening − amortização.
//   6. Saldo devedor final == 0.
//   7. Pré-fixado com taxa > 0 NÃO pode ter juros = 0 em parcela com saldo.
//   8. Sem balão não-previsto: última amortização não pode explodir vs a anterior.
//
// Função PURA — sem DB. `assertValidSchedule` lança InvalidLoanScheduleError.

export class InvalidLoanScheduleError extends Error {
  errors: string[]
  constructor(errors: string[]) {
    super('Agenda de empréstimo inválida: ' + errors.join(' · '))
    this.name = 'InvalidLoanScheduleError'
    this.errors = errors
  }
}

export interface ScheduleRowForValidation {
  number: number
  openingBalance: number
  interest: number
  amortization: number
  correcao?: number
  payment: number
  closingBalance: number
}

export interface ValidateScheduleInput {
  rows: ScheduleRowForValidation[]
  /** principal (NOVO) ou saldo devedor inicial (EM_ANDAMENTO). */
  base: number
  /** taxa mensal > 0 (liga o guard de juros>0 no pré-fixado). */
  ratePositive: boolean
  /** POS = pós-fixado (juros são estimativa; correção plausível). */
  isPostFixed: boolean
  /** tolerância em R$ (default 0,02 — dois centavos, folga de arredondamento). */
  tolerance?: number
}

export interface ScheduleValidationResult {
  ok: boolean
  errors: string[]
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function validateSchedule(input: ValidateScheduleInput): ScheduleValidationResult {
  const { rows, base, ratePositive, tolerance = 0.02 } = input
  const errors: string[] = []

  if (!rows || rows.length === 0) {
    return { ok: false, errors: ['agenda vazia'] }
  }

  // 1. abertura no saldo-base
  if (Math.abs(rows[0].openingBalance - base) > tolerance) {
    errors.push(
      `1ª parcela (#${rows[0].number}) abre em R$ ${rows[0].openingBalance.toFixed(2)}, esperado base R$ ${base.toFixed(2)}`,
    )
  }

  // 2. Σ amort == base
  let somaAmort = 0
  for (const r of rows) somaAmort = r2(somaAmort + r.amortization)
  if (Math.abs(somaAmort - base) > tolerance) {
    errors.push(
      `Σ amortizações R$ ${somaAmort.toFixed(2)} ≠ base R$ ${base.toFixed(2)} (dif R$ ${r2(somaAmort - base).toFixed(2)})`,
    )
  }

  // 3/4/5. cadeia, identidade, fechamento — por parcela
  let cadeiaQuebrou = false
  let identidadeQuebrou = false
  for (let i = 0; i < rows.length; i++) {
    const x = rows[i]
    const corr = x.correcao ?? 0
    if (Math.abs(r2(x.interest + x.amortization + corr) - x.payment) > tolerance && !identidadeQuebrou) {
      errors.push(
        `parcela #${x.number}: payment R$ ${x.payment.toFixed(2)} ≠ juros+amort+correção R$ ${r2(x.interest + x.amortization + corr).toFixed(2)}`,
      )
      identidadeQuebrou = true
    }
    if (Math.abs(r2(x.openingBalance - x.amortization) - x.closingBalance) > tolerance && !cadeiaQuebrou) {
      errors.push(`parcela #${x.number}: fechamento R$ ${x.closingBalance.toFixed(2)} ≠ abertura−amort`)
      cadeiaQuebrou = true
    }
    if (i > 0 && Math.abs(rows[i - 1].closingBalance - x.openingBalance) > tolerance && !cadeiaQuebrou) {
      errors.push(`parcela #${x.number}: abertura não continua o fechamento da anterior`)
      cadeiaQuebrou = true
    }
  }

  // 6. saldo final == 0
  const last = rows[rows.length - 1]
  if (Math.abs(last.closingBalance) > tolerance) {
    errors.push(`saldo devedor final R$ ${last.closingBalance.toFixed(2)} ≠ 0`)
  }

  // 7. pré-fixado com taxa > 0 não pode ter juros = 0
  if (ratePositive) {
    const semJuros = rows.filter((r) => r.openingBalance > tolerance && r.interest <= tolerance)
    if (semJuros.length > 0) {
      errors.push(
        `${semJuros.length} parcela(s) com juros = 0 num empréstimo com taxa > 0 (ex #${semJuros[0].number})`,
      )
    }
  }

  // 8. balão não-previsto: última amortização não pode explodir vs a penúltima
  if (rows.length >= 4) {
    const penult = rows[rows.length - 2].amortization
    if (penult > tolerance && last.amortization > penult * 1.5) {
      errors.push(
        `última parcela (#${last.number}) com amortização desproporcional R$ ${last.amortization.toFixed(2)} vs penúltima R$ ${penult.toFixed(2)} (balão)`,
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

export function assertValidSchedule(input: ValidateScheduleInput): void {
  const result = validateSchedule(input)
  if (!result.ok) throw new InvalidLoanScheduleError(result.errors)
}
