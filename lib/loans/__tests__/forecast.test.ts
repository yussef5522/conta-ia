import { describe, it, expect } from 'vitest'
import { forecastProxima, isCasada, type ForecastInstallment } from '../forecast'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')
function inst(over: Partial<ForecastInstallment>): ForecastInstallment {
  return {
    number: 1, dueDate: D('2026-01-10'), status: 'OPEN', payment: 1000,
    paidTotal: null, reconciledTransactionId: null, paymentsCount: 0, ...over,
  }
}

describe('forecastProxima — previsão da próxima parcela', () => {
  it('PRE: usa o valor da agenda (fato, não previsão)', () => {
    const r = forecastProxima({ rateType: 'PRE' }, [
      inst({ number: 1, status: 'PAID', dueDate: D('2026-01-10') }),
      inst({ number: 2, status: 'OPEN', dueDate: D('2026-02-10'), payment: 2927.02 }),
    ])
    expect(r.valor).toBe(2927.02)
    expect(r.isForecast).toBe(false)
    expect(r.baseNumber).toBeNull()
  })

  it('POS: prevê pelo valor REAL da última parcela CASADA (não a amort nominal)', () => {
    // C61021346: #2 casada (paidTotal 4348.64), #3 OPEN (payment nominal 2777.80)
    const r = forecastProxima({ rateType: 'POS' }, [
      inst({ number: 1, status: 'PAID', dueDate: D('2026-07-10'), paidTotal: 4296.23, paymentsCount: 1 }),
      inst({ number: 2, status: 'PAID', dueDate: D('2026-08-10'), paidTotal: 4348.64, paymentsCount: 1 }),
      inst({ number: 3, status: 'OPEN', dueDate: D('2026-09-10'), payment: 2777.80 }),
    ])
    expect(r.valor).toBe(4348.64) // base #2, NÃO os 2777.80 nominais
    expect(r.isForecast).toBe(true)
    expect(r.baseNumber).toBe(2)
    expect(r.baseDate).toEqual(D('2026-08-10'))
  })

  it('POS: trava — parcela SEM pagamento linkado não vira base (a apurar)', () => {
    // parcela PAID mas sem tx (paidTotal setado por import mas sem ponte) → não casada
    const r = forecastProxima({ rateType: 'POS' }, [
      inst({ number: 1, status: 'PAID', dueDate: D('2026-07-10'), paidTotal: 5000, paymentsCount: 0, reconciledTransactionId: null }),
      inst({ number: 2, status: 'OPEN', dueDate: D('2026-08-10'), payment: 2777.80 }),
    ])
    expect(r.valor).toBeNull() // a apurar
    expect(r.isForecast).toBe(true)
    expect(r.baseNumber).toBeNull()
  })

  it('POS: usa a MAIS RECENTE casada como base', () => {
    const r = forecastProxima({ rateType: 'POS' }, [
      inst({ number: 1, status: 'PAID', dueDate: D('2026-06-10'), paidTotal: 4000, paymentsCount: 1 }),
      inst({ number: 2, status: 'PAID', dueDate: D('2026-07-10'), paidTotal: 4300, reconciledTransactionId: 'tx1' }),
      inst({ number: 3, status: 'OPEN', dueDate: D('2026-08-10'), payment: 2777 }),
    ])
    expect(r.baseNumber).toBe(2) // a de julho, mais recente
    expect(r.valor).toBe(4300)
  })

  it('isCasada: PAID + (reconciled OU payments) = casada; PAID sozinho = não', () => {
    expect(isCasada(inst({ status: 'PAID', reconciledTransactionId: 'x' }))).toBe(true)
    expect(isCasada(inst({ status: 'PAID', paymentsCount: 2 }))).toBe(true)
    expect(isCasada(inst({ status: 'PAID', paymentsCount: 0, reconciledTransactionId: null }))).toBe(false)
    expect(isCasada(inst({ status: 'OPEN', paymentsCount: 1 }))).toBe(false)
  })
})
