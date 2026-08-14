// Sprint Fatura-Paga-Por-Competencia — REGRA 3/REGRA 5: o guard que torna IMPOSSÍVEL
// gravar fatura paga sem dinheiro. Falha antes do fix (não havia barreira), passa
// depois.

import { describe, it, expect } from 'vitest'
import { assertInvoicePaidConsistency, InvoiceInvariantError } from '../invoice-invariant'

describe('assertInvoicePaidConsistency — paga exige paidAmount > 0', () => {
  it('PAID com paidAmount 0 → LANÇA (o estado que mentia)', () => {
    expect(() => assertInvoicePaidConsistency({ status: 'PAID', paidAmount: 0 })).toThrow(
      InvoiceInvariantError,
    )
  })

  it('PARTIAL com paidAmount 0 → LANÇA', () => {
    expect(() => assertInvoicePaidConsistency({ status: 'PARTIAL', paidAmount: 0 })).toThrow(
      InvoiceInvariantError,
    )
  })

  it('PAID com paidAmount > 0 → OK', () => {
    expect(() => assertInvoicePaidConsistency({ status: 'PAID', paidAmount: 500 })).not.toThrow()
  })

  it('OPEN com paidAmount 0 → OK (fatura aberta pode ter 0 pago)', () => {
    expect(() => assertInvoicePaidConsistency({ status: 'OPEN', paidAmount: 0 })).not.toThrow()
  })

  it('CLOSED com paidAmount 0 → OK (fechada aguardando pagamento)', () => {
    expect(() => assertInvoicePaidConsistency({ status: 'CLOSED', paidAmount: 0 })).not.toThrow()
  })
})
