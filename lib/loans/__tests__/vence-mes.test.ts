import { describe, it, expect } from 'vitest'
import { computeVenceMes, type VenceMesLoan } from '../vence-mes'
import type { ForecastInstallment } from '../forecast'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')
function inst(o: Partial<ForecastInstallment>): ForecastInstallment {
  return { number: 1, dueDate: D('2026-08-15'), status: 'OPEN', payment: 1000, paidTotal: null, reconciledTransactionId: null, paymentsCount: 0, ...o }
}
const REF = new Date('2026-08-15T12:00:00.000Z') // "hoje"

describe('computeVenceMes — 4 baldes do mês', () => {
  it('parcela PAID vira "já debitado" com valor REAL (paidTotal)', () => {
    const loans: VenceMesLoan[] = [{ rateType: 'POS', flexible: false, installments: [
      inst({ number: 2, status: 'PAID', dueDate: D('2026-08-10'), paidTotal: 4348.64, paymentsCount: 1 }),
    ] }]
    const r = computeVenceMes(loans, REF)
    expect(r.debitado).toBe(4348.64)
    expect(r.previsto).toBe(4348.64)
  })

  it('OPEN vencida (dueDate < hoje) e não paga = "vencida aguardando" (o caso #23)', () => {
    // 064956967 #23 (PRE), venc 11/08 < 15/08, nominal 4092.02, não debitou
    const loans: VenceMesLoan[] = [{ rateType: 'PRE', flexible: false, installments: [
      inst({ number: 23, status: 'OPEN', dueDate: D('2026-08-11'), payment: 4092.02 }),
    ] }]
    const r = computeVenceMes(loans, REF)
    expect(r.vencida).toBe(4092.02)
    expect(r.aVencer).toBe(0)
    expect(r.linhas[0].bucket).toBe('vencida')
  })

  it('OPEN futura (dueDate >= hoje) = "a vencer", POS pela previsão', () => {
    const loans: VenceMesLoan[] = [{ rateType: 'POS', flexible: false, installments: [
      inst({ number: 1, status: 'PAID', dueDate: D('2026-07-10'), paidTotal: 4348.64, paymentsCount: 1 }),
      inst({ number: 2, status: 'OPEN', dueDate: D('2026-08-24'), payment: 2777.80 }),
    ] }]
    const r = computeVenceMes(loans, REF)
    expect(r.aVencer).toBe(4348.64) // previsão, NÃO os 2777.80 nominais
    expect(r.linhas.find((l) => l.number === 2)?.isForecast).toBe(true)
  })

  it('POS sem casada → a apurar (valor null, não soma)', () => {
    const loans: VenceMesLoan[] = [{ rateType: 'POS', flexible: false, installments: [
      inst({ number: 1, status: 'OPEN', dueDate: D('2026-08-24'), payment: 2000 }),
    ] }]
    const r = computeVenceMes(loans, REF)
    expect(r.aVencer).toBe(0)
    expect(r.linhas[0].valor).toBeNull()
  })

  it('FLEXIBLE não entra', () => {
    const loans: VenceMesLoan[] = [{ rateType: null, flexible: true, installments: [inst({ status: 'OPEN' })] }]
    expect(computeVenceMes(loans, REF).previsto).toBe(0)
  })

  it('cenário completo: debitado + vencida + a vencer somam o previsto', () => {
    const loans: VenceMesLoan[] = [
      { rateType: 'POS', flexible: false, installments: [inst({ number: 2, status: 'PAID', dueDate: D('2026-08-10'), paidTotal: 4348.64, paymentsCount: 1 })] },
      { rateType: 'PRE', flexible: false, installments: [inst({ number: 23, status: 'OPEN', dueDate: D('2026-08-11'), payment: 4092.02 })] },
      { rateType: 'PRE', flexible: false, installments: [inst({ number: 21, status: 'OPEN', dueDate: D('2026-08-25'), payment: 10234.35 })] },
    ]
    const r = computeVenceMes(loans, REF)
    expect(r.debitado).toBe(4348.64)
    expect(r.vencida).toBe(4092.02)
    expect(r.aVencer).toBe(10234.35)
    expect(r.previsto).toBeCloseTo(18675.01, 2)
  })
})
