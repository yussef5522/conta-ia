import { describe, it, expect } from 'vitest'
import { validateSchedule, assertValidSchedule, InvalidLoanScheduleError, type ScheduleRowForValidation } from '../validate-schedule'
import { generateSchedule } from '../amortization'
import { generateMidLifeSchedule } from '../mid-life-schedule'

// Helper: constrói uma parcela coerente (identidade fecha).
const row = (number: number, opening: number, interest: number, amort: number, correcao = 0): ScheduleRowForValidation => ({
  number, openingBalance: opening, interest, amortization: amort, correcao,
  payment: Math.round((interest + amort + correcao) * 100) / 100,
  closingBalance: Math.round((opening - amort) * 100) / 100,
})

describe('validateSchedule — agenda correta passa', () => {
  it('PRICE gerado (NOVO) fecha e passa', () => {
    const s = generateSchedule({ principal: 100000, rateMonthly: 0.017, termMonths: 36, system: 'PRICE', firstDueDate: new Date('2026-01-15') })
    const v = validateSchedule({ rows: s, base: 100000, ratePositive: true, isPostFixed: false })
    expect(v.ok).toBe(true)
    expect(v.errors).toEqual([])
  })
  it('SAC gerado (NOVO) fecha e passa', () => {
    const s = generateSchedule({ principal: 60000, rateMonthly: 0.02, termMonths: 24, system: 'SAC', firstDueDate: new Date('2026-01-15') })
    expect(validateSchedule({ rows: s, base: 60000, ratePositive: true, isPostFixed: false }).ok).toBe(true)
  })
})

describe('validateSchedule — pega os furos reais da caçula', () => {
  it('BALÃO na última parcela (payment const, amort explode) → falha', () => {
    // Reproduz o padrão gravado: payment fixo 4.166,66, juros=saldo×0,4868%,
    // amort=payment−juros, e a última amortiza o resíduo inteiro (balão).
    const rows: ScheduleRowForValidation[] = []
    let saldo = 104166.72
    const i = 0.004868
    for (let n = 1; n <= 5; n++) {
      const juros = Math.round(saldo * i * 100) / 100
      const isLast = n === 5
      const amort = isLast ? saldo : Math.round((4166.66 - juros) * 100) / 100
      rows.push({ number: n, openingBalance: saldo, interest: juros, amortization: Math.round(amort * 100) / 100, correcao: 0, payment: 4166.66, closingBalance: Math.round((saldo - amort) * 100) / 100 })
      saldo = Math.round((saldo - amort) * 100) / 100
    }
    const v = validateSchedule({ rows, base: 104166.72, ratePositive: true, isPostFixed: true })
    expect(v.ok).toBe(false)
    // identidade quebra na última (payment 4166.66 ≠ juros+amort do balão) E balão detectado
    expect(v.errors.join(' ')).toMatch(/payment|balão|amortização desproporcional/i)
  })

  it('PRÉ-fixado com juros=0 em toda parcela (caso C41033828) → falha', () => {
    const rows = [row(1, 30000, 0, 10000), row(2, 20000, 0, 10000), row(3, 10000, 0, 10000)]
    const v = validateSchedule({ rows, base: 30000, ratePositive: true, isPostFixed: false })
    expect(v.ok).toBe(false)
    expect(v.errors.join(' ')).toMatch(/juros = 0/i)
  })

  it('Σ amortizações ≠ base → falha', () => {
    const rows = [row(1, 10000, 100, 4000), row(2, 6000, 60, 4000)] // Σamort 8000 ≠ 10000
    const v = validateSchedule({ rows, base: 10000, ratePositive: true, isPostFixed: false })
    expect(v.ok).toBe(false)
    expect(v.errors.join(' ')).toMatch(/amortizações|final/i)
  })

  it('1ª parcela não abre no saldo-base (parcela fantasma) → falha', () => {
    const rows = [row(1, 0, 0, 0), row(2, 10000, 100, 10000)]
    const v = validateSchedule({ rows, base: 10000, ratePositive: true, isPostFixed: false })
    expect(v.ok).toBe(false)
    expect(v.errors.join(' ')).toMatch(/abre em/i)
  })

  it('assertValidSchedule lança InvalidLoanScheduleError', () => {
    expect(() => assertValidSchedule({ rows: [row(1, 10000, 0, 5000)], base: 10000, ratePositive: true, isPostFixed: false }))
      .toThrow(InvalidLoanScheduleError)
  })
})

describe('gerador mid-life — não grava mais agenda que não fecha', () => {
  it('parcela × prazo < saldo (o bug real) agora LANÇA, não gera balão', () => {
    // 4.166,66 × 25 = 104.166,50 < saldo 104.166,72 → solver falha → antes caía
    // pra nominal e gerava balão; agora lança InvalidLoanScheduleError.
    expect(() => generateMidLifeSchedule({
      outstandingBalance: 104166.72, rateMonthly: 0.004868, futureCount: 25,
      startNumber: 11, firstDueDate: new Date('2026-06-15'), system: 'PRICE',
      isPostFixed: true, fixedPayment: 4166.66,
    })).toThrow(InvalidLoanScheduleError)
  })

  it('parcela fixa VÁLIDA continua gerando agenda que fecha (sem regressão)', () => {
    const rows = generateMidLifeSchedule({
      outstandingBalance: 52707.06, rateMonthly: 0.0195, futureCount: 15,
      startNumber: 21, firstDueDate: new Date('2026-06-15'), system: 'PRICE',
      isPostFixed: false, fixedPayment: 4092.02,
    })
    const v = validateSchedule({ rows: rows.map((r) => ({ ...r })), base: 52707.06, ratePositive: true, isPostFixed: false })
    expect(v.ok).toBe(true)
  })
})
