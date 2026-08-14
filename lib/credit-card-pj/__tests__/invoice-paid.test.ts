// Sprint Fatura-Paga-Por-Competencia — REGRA 3: executa a decisão de "paga".
// O caso que MORDEU: pagamento de junho NÃO pode fazer a fatura de setembro
// aparecer paga.

import { describe, it, expect } from 'vitest'
import { invoiceMonthIsPaid } from '../invoice-paid'

describe('invoiceMonthIsPaid — paga é por COMPETÊNCIA, não por cartão', () => {
  it('o BUG: pagamento de junho NÃO paga a fatura de setembro', () => {
    const paidMonths = ['2026-06'] // o cartão só tem pagamento de junho
    expect(invoiceMonthIsPaid(paidMonths, '2026-09')).toBe(false) // setembro NÃO paga
    expect(invoiceMonthIsPaid(paidMonths, '2026-06')).toBe(true) // junho paga
  })

  it('sem competência ativa (cartão sem fatura) → nunca paga', () => {
    expect(invoiceMonthIsPaid(['2026-06'], null)).toBe(false)
    expect(invoiceMonthIsPaid([], null)).toBe(false)
  })

  it('sem nenhum pagamento → não paga', () => {
    expect(invoiceMonthIsPaid([], '2026-09')).toBe(false)
  })

  it('vários meses pagos → cada um confere o seu', () => {
    const paid = ['2026-06', '2026-07']
    expect(invoiceMonthIsPaid(paid, '2026-06')).toBe(true)
    expect(invoiceMonthIsPaid(paid, '2026-07')).toBe(true)
    expect(invoiceMonthIsPaid(paid, '2026-08')).toBe(false) // agosto ainda não
  })

  it('ignora null/undefined na lista de meses pagos', () => {
    expect(invoiceMonthIsPaid([null, undefined, '2026-08'], '2026-08')).toBe(true)
    expect(invoiceMonthIsPaid([null, undefined], '2026-08')).toBe(false)
  })
})
